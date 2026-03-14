import asyncio
import logging
import os
import signal
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import partial
from typing import (
    Annotated,
    Any,
)

import sentry_sdk
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import JSONResponse

sentry_dsn = os.environ.get("FAI_SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.environ.get("ENVIRONMENT_TYPE", "unknown"),
        traces_sample_rate=0.1,
        sample_rate=1.0,
        send_default_pii=False,
    )

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    force=True,
)
logger = logging.getLogger(__name__)

startup_time: float | None = None
shutdown_event = asyncio.Event()
active_streams: set[asyncio.Task[Any]] = set()


def track_stream(task: asyncio.Task[Any]) -> None:
    active_streams.add(task)
    task.add_done_callback(lambda t: active_streams.discard(t))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global startup_time
    startup_time = time.time()
    logger.info("FAI Chat service starting up")

    loop = asyncio.get_event_loop()

    def graceful_shutdown(sig: signal.Signals) -> None:
        logger.info(f"Received signal {sig.name}, initiating graceful shutdown")
        shutdown_event.set()
        if active_streams:
            logger.info(f"Waiting for {len(active_streams)} active streams to complete")
        else:
            logger.info("No active streams, shutting down")
            loop.remove_signal_handler(sig)
            loop.call_soon(os.kill, os.getpid(), sig)

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, partial(graceful_shutdown, sig))

    yield

    if active_streams:
        logger.info(f"Shutdown: waiting for {len(active_streams)} active streams (30s timeout)")
        done, pending = await asyncio.wait(active_streams, timeout=30)
        if pending:
            logger.warning(f"Shutdown: {len(pending)} streams did not complete in time")


app = FastAPI(
    title="FAI Chat Service",
    version="0.1.0",
    description="ECS-based chat endpoint for Fern AI",
    lifespan=lifespan,
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if exc.status_code >= 500:
        sentry_sdk.capture_exception(
            exc,
            tags={
                "domain": request.headers.get("x-fern-host", "unknown"),
                "status_code": str(exc.status_code),
            },
        )
    elif exc.status_code >= 400:
        sentry_sdk.capture_message(
            f"HTTP {exc.status_code}: {exc.detail}",
            level="warning",
            tags={
                "domain": request.headers.get("x-fern-host", "unknown"),
                "status_code": str(exc.status_code),
            },
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


def get_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization token",
        )

    return auth_header[7:]


BearerToken = Annotated[str, Depends(get_bearer_token)]


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "fai-chat"}


@app.get("/health/ready")
async def readiness_check() -> dict[str, Any]:
    if startup_time is None:
        raise HTTPException(status_code=503, detail="Service starting")

    checks: dict[str, Any] = {
        "uptime_seconds": round(time.time() - startup_time, 2),
        "active_streams": len(active_streams),
        "shutdown_requested": shutdown_event.is_set(),
    }

    return {"status": "ready", "service": "fai-chat", "checks": checks}


from .routes import chat  # noqa: E402, F401
