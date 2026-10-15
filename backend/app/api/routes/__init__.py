from app.api.routes import cases, demo, evidence_upload, live, report, reviews

ROUTERS = [
    demo.router,
    cases.router,
    live.router,
    reviews.router,
    evidence_upload.router,
    report.router,
]
