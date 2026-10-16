from app.api.routes import (
    cases,
    demo,
    evidence_upload,
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
]
