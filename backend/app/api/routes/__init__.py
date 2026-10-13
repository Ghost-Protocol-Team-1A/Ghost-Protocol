from app.api.routes import cases, demo, evidence_upload, report

ROUTERS = [demo.router, cases.router, evidence_upload.router, report.router]
