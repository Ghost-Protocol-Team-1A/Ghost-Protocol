import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ROUTERS
from app.errors import install_error_handlers
from app.services.store import store

_WRITES = {"POST", "PUT", "PATCH", "DELETE"}


def create_app() -> FastAPI:
    app = FastAPI(
        title="Ghost Protocol API",
        description="Evidence intelligence for incident investigations. Demo data is fictional.",
        version="0.1.0",
    )
    origins = os.getenv("GP_CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"]
    )
    install_error_handlers(app)

    @app.middleware("http")
    async def save_after_writes(request: Request, call_next):
        """Persist investigators' cases after every successful change, so restarts lose nothing."""
        response = await call_next(request)
        if request.method in _WRITES and response.status_code < 400:
            store.save()
        return response

    for router in ROUTERS:
        app.include_router(router)
    return app


app = create_app()
