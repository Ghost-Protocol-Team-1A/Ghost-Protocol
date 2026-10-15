# Security, privacy and limitations

Ghost Protocol handles evidence, so this document states what the MVP protects, what it does
not, and what a real deployment would need. **The current build is suitable for a controlled
demo only.**

## What the MVP does

| Area | Control | Where |
| --- | --- | --- |
| Evidence integrity | SHA-256 of the original bytes at ingestion; the hash is shown in the viewer, the report and the audit trail | `services/ingest.py`, `storage/hashing.py` |
| Originals preserved | Source files and source timestamps are never modified; derived values are stored alongside | `services/normalize.py`, store |
| Upload type checks | Extension must be on the allow-list **and** match the file's content signature (a renamed executable is rejected) | `storage/validation.py` |
| Upload size | Limit enforced while streaming (`MAX_UPLOAD_MB`, default 50) | `storage/hashing.py` |
| Path safety | Files are stored under their SHA-256; the uploaded filename is cleaned and kept only as metadata, never used in a path | `storage/` |
| Duplicate detection | The same bytes uploaded twice return the existing item | upload route *(#19)* |
| Serving originals | Originals are streamed back byte-for-byte for playback with `nosniff`; everything except PDF also gets a `sandbox` CSP, so a stored file cannot run as a page | `GET …/evidence/{id}/file` |
| Evidence is data | Uploaded files are never executed, parsed as code, or followed as instructions | whole pipeline |
| No third parties | Evidence is not sent to any external or AI service | whole pipeline |
| Input validation | Pydantic models on every write; length limits on titles, notes and descriptions; timezone required on case windows | `models/domain.py` |
| Error handling | One error shape; unexpected errors return a generic message and no stack trace | `errors.py` |
| Writes from the browser | Go through server actions that re-validate input before calling the API | `frontend/src/app/**/actions.ts` |
| CORS | Only origins in `GP_CORS_ORIGINS` (default `http://localhost:3000`) | `main.py` |
| Accountability | Uploads, live evidence, reviews and resets are written to the audit trail with actor and time | store |
| Secrets | None in the repository; configuration through environment variables; `.env` is git-ignored | `.env.example` |
| Contribution integrity | A required check rejects pull requests that credit AI tools as co-authors; `main` requires a reviewed pull request | `.github/workflows/` |

## What it does not do

- **No authentication or authorization.** Anyone who can reach the app can read every case,
  upload evidence, record reviews and reset the demo. The reviewer name on decisions comes from the demo sign-in (a cookie, no password) or defaults to `BJ`, and is not verified.
- **Accepted formats** cover common phone, camera and office output (33 extensions: MP4/MOV/WebM video, M4A/MP3/WAV/AAC/OGG/Opus/AMR audio, JPEG/HEIC/PNG images, PDF/DOCX/XLSX, CSV/JSON/text). Each is checked against its byte signature. Uploaded media is stored and playable but **not yet extracted** into timeline events.
- **No encryption at rest.** Uploaded files are stored as plain files on the server's disk.
- **No persistence guarantees.** Cases and the audit trail live in memory and are lost on restart
  or reset. The audit trail is append-only in code, but not tamper-evident.
- **No deletion or retention policy.** Uploaded files stay in `GP_STORAGE_DIR` until removed by
  hand, even after a demo reset.
- **No malware scanning.** Content-signature checks stop renamed executables; they are not a
  virus scan.
- **No rate limiting** on uploads or other writes.
- **Hashes prove change, not origin.** A SHA-256 shows a file has not changed since ingestion.
  It does not show the file was authentic before ingestion.

## Responsible use

- The system never states that a person is responsible or guilty. A conflict is a prompt for
  review, not proof of tampering.
- Identity claims without supporting evidence are flagged (`RULE-CLAIM-001`) rather than resolved.
- All demo data is fictional and labeled as such on every workstation screen and in the report.
- Do not upload real evidence or personal data to a demo deployment.

## Before any real deployment

1. Authentication, per-case authorization, and real reviewer identities on every audit entry.
2. A database with backups, and an append-only, hash-chained audit log.
3. Encryption at rest for evidence files and TLS everywhere.
4. A retention and deletion policy, with deletion itself audited.
5. Malware scanning and quarantine for uploads; rate limits.
6. A security review of dependencies and of the upload path.

## Reporting a problem

Contact the team at **info@rayvme.com**. Please do not open a public issue for a security
problem.
