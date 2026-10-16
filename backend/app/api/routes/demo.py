from fastapi import APIRouter

from app.services.store import store

router = APIRouter(tags=["demo"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/demo/reset")
def reset() -> dict[str, object]:
    """Restore the seeded demo case. Cases investigators created are kept."""
    reset_ids = store.reset_demo()
    for case_id in reset_ids:
        store.record(case_id, "SYS", "Demo reset", case_id, "Restored seeded state")
    return {"status": "reset", "cases": reset_ids}
