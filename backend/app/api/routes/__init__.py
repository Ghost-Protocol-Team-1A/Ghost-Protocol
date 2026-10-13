from app.api.routes import cases, demo, evidence_upload, live, report

ROUTERS = [demo.router, cases.router, live.router, evidence_upload.router, report.router]
