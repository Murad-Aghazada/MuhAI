import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import agent, auth, bank, compute, workspace
from app.core.config import settings
from app.db.migrate import run_upgrade_to_head

logger = logging.getLogger(__name__)

# Uvicorn configures its own three loggers and leaves the root alone, so every
# `logging.getLogger(__name__)` in this codebase was writing into a logger with
# no handler — the messages went nowhere. That is fine until something needs
# diagnosing in a container, at which point the one line that would have
# explained it was never printed. One handler on the root, at INFO.
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bring the DB schema up to head before serving requests.

    Run in a worker thread because Alembic's env.py drives an async engine via
    ``asyncio.run`` — which cannot be nested inside the running event loop.

    Skipped when ``RUN_MIGRATIONS_ON_STARTUP`` is false: under Docker a
    one-shot ``migrate`` service has already done this, and letting several
    uvicorn workers each try it would have them racing for the same lock.
    """
    if settings.RUN_MIGRATIONS_ON_STARTUP:
        try:
            await asyncio.to_thread(run_upgrade_to_head)
        except Exception as exc:  # pragma: no cover - depends on live DB
            logger.error("Startup migration failed: %s", exc)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered accounting & SME finance assistant.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
async def root() -> dict[str, str]:
    return {"status": "ok", "service": settings.PROJECT_NAME}


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "healthy"}


# Mount all routers under /api. Five of them: the workspace holds the data,
# compute does the maths over a posted snapshot, auth issues the token that
# scopes the first to a company, bank is the only surface that talks to
# anything outside this stack — optional, and stateless like compute — and
# agent is the second company-scoped surface, reading the workspace tables
# read-only on the model's behalf.
for router in (auth, workspace, compute, bank, agent):
    app.include_router(router.router, prefix=settings.API_PREFIX)
