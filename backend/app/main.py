"""The FastAPI app. Run with `uv run uvicorn backend.app.main:app`."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import clock, config, db
from .errors import ApiError, validation_error_response
from .routers import activities, contacts, dashboard, deals, organizations, pipeline
from .seed import seed

# Only requests addressed to this computer are answered. Without this, a web page
# could point its own domain at 127.0.0.1 (DNS rebinding) and read the data.
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]


def open_database(path: Path):
    """Open the database file, creating and seeding it if it doesn't exist yet.

    If seeding a new file fails, the file is removed again, so the next start
    tries afresh instead of finding an empty database it thinks is in use.
    """
    is_new = not path.exists()
    engine = db.make_engine(path)
    try:
        db.create_tables(engine)
        if is_new:
            with engine.begin() as conn:
                seed(conn, clock.now())
    except Exception:
        engine.dispose()
        if is_new:
            path.unlink(missing_ok=True)
        raise
    return engine


def create_app(db_path: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.engine = open_database(db_path or config.db_path())
        yield
        app.state.engine.dispose()

    app = FastAPI(title="Accountable", lifespan=lifespan)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_request: Request, exc: RequestValidationError):
        return validation_error_response(exc.errors())

    @app.exception_handler(ApiError)
    async def on_api_error(_request: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status_code, content=exc.body())

    @app.get("/api/health")
    def health():
        return {"status": "ok", "today": clock.today().isoformat()}

    for module in (organizations, contacts, deals, activities, pipeline, dashboard):
        app.include_router(module.router, prefix="/api")

    return app


app = create_app()
