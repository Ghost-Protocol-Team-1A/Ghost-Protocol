from fastapi import APIRouter

from app.services.store import store

router = APIRouter(tags=["demo"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/demo/reset")
def reset() -> dict[str, object]:
    store.reset()
    for case_id in store.cases:
        store.record(case_id, "SYS", "Demo reset", case_id, "Restored seeded state")
    return {"status": "reset", "cases": list(store.cases)}
