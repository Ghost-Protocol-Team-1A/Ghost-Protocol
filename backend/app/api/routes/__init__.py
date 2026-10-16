from app.api.routes import (
    ai,
    cases,
    demo,
    evidence_upload,
    export,
    findings,
    live,
    report,
    reviews,
    workbench,
)

ROUTERS = [
    demo.router,
    cases.router,
    live.router,
    reviews.router,
    evidence_upload.router,
    report.router,
    workbench.router,
    findings.router,
    ai.router,
    export.router,
]
