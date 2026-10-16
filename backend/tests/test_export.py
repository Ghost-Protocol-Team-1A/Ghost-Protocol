"""Power BI / Tableau export: tidy tables that join on IDs, with real UTC datetimes."""

import csv
import io
import zipfile
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app
from app.services.store import store


@pytest.fixture()
def client():
    store.reset()
    return TestClient(app)


def test_workbook_has_one_sheet_per_table_with_utc_datetimes(client):
    res = client.get("/api/cases/CASE-001/export?format=xlsx")
    assert res.status_code == 200
    assert 'filename="CASE-001-data.xlsx"' in res.headers["content-disposition"]
    wb = load_workbook(io.BytesIO(res.content))
    assert wb.sheetnames == [
        "about",
        "evidence",
        "events",
        "claims",
        "claim_citations",
        "conflicts",
        "questions",
        "audit",
    ]
    events = wb["events"]
    header = [c.value for c in events[1]]
    rows = {
        r[1]: dict(zip(header, r, strict=True))
        for r in events.iter_rows(min_row=2, values_only=True)
    }
    ev = rows["EV-014"]
    assert ev["source_time_as_recorded"] == "2026-10-10T21:16:00+01:00"
    assert ev["normalized_time_utc"] == datetime(2026, 10, 10, 20, 14)
    assert ev["source_name"] == "Loading-bay CCTV" and "C-02" in ev["conflict_ids"]
    citations = list(wb["claim_citations"].iter_rows(min_row=2, values_only=True))
    assert ("CASE-001", "CL-05", "E-04", "contradicts", "rows 17-18") in citations


def test_every_foreign_key_resolves(client):
    wb = load_workbook(io.BytesIO(client.get("/api/cases/CASE-001/export").content))

    def column(sheet, name):
        rows = list(wb[sheet].iter_rows(values_only=True))
        i = rows[0].index(name)
        return {r[i] for r in rows[1:]}

    evidence = column("evidence", "evidence_id")
    assert column("events", "evidence_id") <= evidence
    assert column("claim_citations", "evidence_id") <= evidence
    assert column("claim_citations", "claim_id") <= column("claims", "claim_id")
    assert column("claims", "question_id") - {""} <= column("questions", "question_id")


def test_csv_zip_has_the_same_tables(client):
    res = client.get("/api/cases/CASE-001/export?format=zip")
    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        assert sorted(z.namelist()) == sorted(
            [
                "evidence.csv",
                "events.csv",
                "claims.csv",
                "claim_citations.csv",
                "conflicts.csv",
                "questions.csv",
                "audit.csv",
            ]
        )
        events = list(csv.DictReader(io.StringIO(z.read("events.csv").decode())))
    ev = next(r for r in events if r["event_id"] == "EV-014")
    assert ev["normalized_time_utc"] == "2026-10-10T20:14:00Z"


def test_unknown_format_is_refused(client):
    assert client.get("/api/cases/CASE-001/export?format=pbix").status_code == 422
