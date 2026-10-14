"""Evidence upload checks (issue #3): what may be uploaded, its digest, and where it is stored.

The acceptance list drives these tests: a traversal filename, an executable renamed to `.pdf`, an
oversize upload, an empty upload, the same file twice, and a valid CSV — plus the digest matching
`shasum -a 256` and no user-supplied text ever becoming a path component.
"""

import hashlib
import io
import shutil
import subprocess

import pytest

from app.errors import ApiError
from app.models.domain import EvidenceType
from app.storage.hashing import CHUNK_SIZE, sha256_stream, storage_dir, stored_path
from app.storage.validation import (
    DEFAULT_MAX_UPLOAD_MB,
    MAX_FILENAME_LENGTH,
    UNNAMED,
    clean_filename,
    detect_type,
    extension_of,
    max_upload_bytes,
)

CSV_BYTES = b"row,timestamp,badge_id\n1,2026-10-10T21:12:00+01:00,B-04\n"

# Real headers, not placeholders: a test that passes with fake bytes for .png would still pass
# when the checker is wrong, which is the opposite of what this file is for.
VALID_UPLOADS = {
    "mp4": (b"\x00\x00\x00\x18ftypmp42", EvidenceType.VIDEO),
    "wav": (b"RIFF$\x00\x00\x00WAVEfmt ", EvidenceType.AUDIO),
    "mp3": (b"ID3\x03\x00\x00\x00\x00\x00$", EvidenceType.AUDIO),
    "csv": (CSV_BYTES, EvidenceType.CSV),
    "json": (b'{"badge_id": "B-04", "row": 1}', EvidenceType.JSON),
    "pdf": (b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", EvidenceType.PDF),
    "txt": (b"Interview note: the badge reader was slow.\n", EvidenceType.TEXT),
    "png": (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", EvidenceType.IMAGE),
    "jpg": (b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01", EvidenceType.IMAGE),
}

WINDOWS_EXECUTABLE = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"


def error_of(call):
    """Run `call` and return the ApiError it raises."""
    with pytest.raises(ApiError) as raised:
        call()
    return raised.value


# --- the filename is metadata, never a path ----------------------------------------------------


def test_traversal_filename_is_reduced_to_its_base():
    assert clean_filename("../../etc/passwd") == "passwd"
    assert clean_filename("C:\\Users\\allison\\Downloads\\note.txt") == "note.txt"
    assert clean_filename("../../../evil/./payload.mp4") == "payload.mp4"


def test_control_and_invisible_characters_are_stripped():
    assert clean_filename("gen\x00esis.mp4") == "genesis.mp4"
    assert clean_filename("line\r\nbreak.wav") == "linebreak.wav"
    assert clean_filename("tag\u200b\u200bdata.csv") == "tagdata.csv"


def test_an_overlong_name_is_trimmed_without_losing_the_extension():
    cleaned = clean_filename("a" * 300 + ".csv")
    assert len(cleaned) == MAX_FILENAME_LENGTH
    assert cleaned.endswith(".csv")


def test_a_name_that_survives_cleaning_is_left_alone():
    assert clean_filename("shift-log-2026-10-10.csv") == "shift-log-2026-10-10.csv"


def test_an_unnameable_upload_gets_a_placeholder():
    assert clean_filename("") == UNNAMED
    assert clean_filename("../../") == UNNAMED
    assert clean_filename("...") == UNNAMED
    assert clean_filename("\x00\x1f") == UNNAMED


def test_extension_comes_from_the_cleaned_name():
    assert extension_of("../../etc/passwd.csv") == "csv"
    assert extension_of("AUDIT.PNG") == "png"
    assert extension_of("no extension here") == ""


# --- what may be uploaded ----------------------------------------------------------------------


def test_valid_csv_is_accepted_as_csv():
    assert detect_type("shift-log.csv", CSV_BYTES) == EvidenceType.CSV


def test_every_allowed_extension_is_accepted_for_its_own_bytes():
    for extension, (head, expected) in VALID_UPLOADS.items():
        assert detect_type(f"evidence.{extension}", head) is expected


def test_an_executable_renamed_to_pdf_is_rejected():
    error = error_of(lambda: detect_type("audit.pdf", WINDOWS_EXECUTABLE))
    assert error.status == 415
    assert error.code == "type_mismatch"
    assert "windows executable" in error.details["detected"]


def test_a_disallowed_extension_is_rejected_before_the_bytes_are_considered():
    error = error_of(lambda: detect_type("tool.exe", WINDOWS_EXECUTABLE))
    assert error.status == 415
    assert error.code == "type_not_allowed"
    assert error.details["extension"] == "exe"
    assert "pdf" in error.details["allowed"]


def test_extension_and_bytes_have_to_agree_in_both_directions():
    # Correct bytes, wrong claim: a PNG called .jpg is still a mismatch.
    assert detect_type("frame.png", VALID_UPLOADS["png"][0]) is EvidenceType.IMAGE
    assert error_of(lambda: detect_type("frame.jpg", VALID_UPLOADS["png"][0])).code == (
        "type_mismatch"
    )


def test_binary_bytes_cannot_pass_as_text():
    assert error_of(lambda: detect_type("notes.txt", WINDOWS_EXECUTABLE)).code == "type_mismatch"
    assert error_of(lambda: detect_type("notes.txt", b"\x7fELF\x02\x01\x01")).code == (
        "type_mismatch"
    )


def test_a_mp3_frame_without_an_id3_tag_is_still_audio():
    assert detect_type("call.mp3", b"\xff\xfb\x90\x00\x00\x00") is EvidenceType.AUDIO


def test_a_json_document_starting_with_a_bom_is_still_json():
    assert detect_type("events.json", "\ufeff[2026, 10, 10]".encode()) is EvidenceType.JSON


def test_empty_upload_is_rejected_with_422():
    error = error_of(lambda: detect_type("evidence.csv", b""))
    assert error.status == 422
    assert error.code == "empty_file"


def test_a_rejection_does_not_echo_the_raw_filename():
    # The response body is rendered later; a hostile name must not arrive intact there either.
    error = error_of(lambda: detect_type("../../etc/evil\x00.exe", WINDOWS_EXECUTABLE))
    assert error.details["filename"] == "evil.exe"
    assert "/" not in error.message
    assert "\x00" not in error.message


# --- the size limit ----------------------------------------------------------------------------


def test_oversize_upload_is_refused_mid_stream():
    limit = 2 * 1024 * 1024
    stream = io.BytesIO(b"\x00" * (limit + 1024))
    error = error_of(lambda: sha256_stream(stream, limit))
    assert error.status == 413
    assert error.code == "file_too_large"
    assert error.details["max_bytes"] == limit
    assert error.details["read_bytes"] == limit + 1024


def test_a_file_exactly_at_the_limit_is_hashed():
    limit = 1024
    digest, size = sha256_stream(io.BytesIO(b"a" * limit), limit)
    assert size == limit
    assert digest == hashlib.sha256(b"a" * limit).hexdigest()


def test_the_limit_comes_from_max_upload_mb_and_falls_back_to_the_default(monkeypatch):
    monkeypatch.delenv("MAX_UPLOAD_MB", raising=False)
    assert max_upload_bytes() == DEFAULT_MAX_UPLOAD_MB * 1024 * 1024

    monkeypatch.setenv("MAX_UPLOAD_MB", "5")
    assert max_upload_bytes() == 5 * 1024 * 1024

    # A typo in the environment must not become "reject every upload".
    for unusable in ("not-a-number", "0", "-4", ""):
        monkeypatch.setenv("MAX_UPLOAD_MB", unusable)
        assert max_upload_bytes() == DEFAULT_MAX_UPLOAD_MB * 1024 * 1024


# --- the digest and where the bytes go -------------------------------------------------------


def test_streamed_digest_matches_a_one_shot_hash_across_chunk_bounds():
    # One byte over a chunk boundary is where a streaming hash goes wrong.
    payload = bytes(range(256)) * (CHUNK_SIZE // 256 + 1)
    digest, size = sha256_stream(io.BytesIO(payload), len(payload))
    assert size == len(payload)
    assert digest == hashlib.sha256(payload).hexdigest()


def test_digest_matches_shasum_of_the_file(tmp_path):
    if shutil.which("shasum") is None and shutil.which("sha256sum") is None:
        pytest.skip("no shasum or sha256sum on this machine")
    path = tmp_path / "shift-log.csv"
    path.write_bytes(CSV_BYTES)
    tool = shutil.which("shasum") or shutil.which("sha256sum")
    command = [tool, "-a", "256", str(path)] if "shasum" in tool else [tool, str(path)]
    reported = subprocess.run(command, capture_output=True, text=True, check=True).stdout
    with path.open("rb") as handle:
        digest, size = sha256_stream(handle, max_upload_bytes())
    assert reported.split()[0] == digest
    assert size == len(CSV_BYTES)


def test_an_empty_stream_hashes_to_the_empty_digest():
    digest, size = sha256_stream(io.BytesIO(b""), 1024)
    assert size == 0
    assert digest == hashlib.sha256(b"").hexdigest()


def test_bytes_are_stored_under_a_sharded_hash_path(tmp_path):
    digest, _ = sha256_stream(io.BytesIO(CSV_BYTES), 1024)
    path = stored_path(digest, tmp_path)
    assert path == tmp_path / digest[:2] / digest


def test_a_hostile_digest_never_becomes_a_path(tmp_path):
    for hostile in ("../../etc/passwd", "ab" * 100, "0" * 63, "A" * 64, ""):
        error = error_of(lambda candidate=hostile: stored_path(candidate, tmp_path))
        assert error.status == 422
        assert error.code == "invalid_digest"


def test_the_same_file_twice_lands_on_the_same_path(tmp_path):
    first, _ = sha256_stream(io.BytesIO(CSV_BYTES), 1024)
    second, _ = sha256_stream(io.BytesIO(CSV_BYTES), 1024)
    assert first == second

    path = stored_path(first, tmp_path)
    path.parent.mkdir(parents=True)
    path.write_bytes(CSV_BYTES)
    # The route's duplicate check is "does this hash's path already exist" — a re-upload of the
    # same bytes maps onto the file that is already there instead of writing a second copy.
    assert stored_path(second, tmp_path) == path
    assert stored_path(second, tmp_path).exists()


def test_different_bytes_get_different_paths(tmp_path):
    left = stored_path(sha256_stream(io.BytesIO(CSV_BYTES), 1024)[0], tmp_path)
    right = stored_path(sha256_stream(io.BytesIO(CSV_BYTES + b"\n"), 1024)[0], tmp_path)
    assert left != right


def test_no_user_supplied_text_reaches_the_stored_path(tmp_path):
    # An upload that passes every check, named to try to reach into the filesystem.
    filename = "../../../../etc/evil-dir/passwd.csv"
    assert detect_type(filename, CSV_BYTES) is EvidenceType.CSV
    digest, _ = sha256_stream(io.BytesIO(CSV_BYTES), 1024)
    path = stored_path(digest, tmp_path)
    assert clean_filename(filename) not in str(path.relative_to(tmp_path))
    for fragment in ("evil", "passwd", "csv", "dir", ".."):
        assert fragment not in path.name
    assert path.is_relative_to(tmp_path)
    assert path.name == digest


def test_storage_directory_follows_gp_storage_dir(tmp_path, monkeypatch):
    monkeypatch.delenv("GP_STORAGE_DIR", raising=False)
    assert str(storage_dir()) == "backend/data/evidence"
    monkeypatch.setenv("GP_STORAGE_DIR", str(tmp_path))
    assert storage_dir() == tmp_path
