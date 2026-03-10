import os
from collections.abc import AsyncGenerator
from typing import Any

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from fai.db import async_session_maker
from fai.jobs.scribe_pr_status_job import check_scribe_pr_statuses
from fai.scheduler import (
    start_scheduler,
    stop_scheduler,
)
from fai.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.session_manager import resume_active_sessions
from utils.init_db import init

sentry_dsn = os.environ.get("FAI_SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.environ.get("ENVIRONMENT", "dev"),
        traces_sample_rate=0.1,
        sample_rate=1.0,
        send_default_pii=False,
    )


async def start_scheduler_and_run_startup_tasks() -> None:
    try:
        start_scheduler()
        LOGGER.info("Setup: Scheduler started.")
    except Exception as e:
        LOGGER.error(f"Setup: Error starting scheduler: {e}")

    try:
        async with async_session_maker() as db:
            results = await check_scribe_pr_statuses(db)
            LOGGER.info(
                f"Setup: Scribe PR status check completed on startup: "
                f"{results['checked']} checked, {results['merged']} merged, {results['errors']} errors"
            )
    except Exception as e:
        LOGGER.error(f"Setup: Error checking Scribe PR statuses on startup: {e}")

    try:
        await resume_active_sessions()
        LOGGER.info("Setup: Scribe session polling resumed.")
    except Exception as e:
        LOGGER.error(f"Setup: Error resuming Scribe sessions: {e}")


async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if VARIABLES.IS_LOCAL:
        if not CONFIG.SKIP_LOCAL_DB_INIT:
            LOGGER.info("Setup: Local development mode. Initializing database...")
            try:
                await init()
                LOGGER.info("Setup: Database initialized.")
            except Exception as e:
                LOGGER.error(f"Setup: Error initializing database: {e}")
                raise e
        else:
            LOGGER.info("Setup: Overriding local database initialization.")
    else:
        LOGGER.info("Setup: Production mode. Database not initialized.")

    if not VARIABLES.IS_LOCAL:
        LOGGER.info("Setup: Production mode. Starting scheduler and running startup tasks...")
        await start_scheduler_and_run_startup_tasks()
    elif CONFIG.ENABLE_LOCAL_SCHEDULED_JOBS:
        LOGGER.info("Setup: Overriding local development mode. Starting scheduler and running startup tasks...")
        await start_scheduler_and_run_startup_tasks()
    else:
        LOGGER.info("Setup: Local development mode. Scheduler and scheduled jobs disabled.")

    yield

    if not VARIABLES.IS_LOCAL:
        try:
            stop_scheduler()
            LOGGER.info("Shutdown: Scheduler stopped.")
        except Exception as e:
            LOGGER.error(f"Shutdown: Error stopping scheduler: {e}")
    elif CONFIG.ENABLE_LOCAL_SCHEDULED_JOBS:
        LOGGER.info("Shutdown: Local development mode. Stopping scheduler...")
        try:
            stop_scheduler()
            LOGGER.info("Shutdown: Scheduler stopped.")
        except Exception as e:
            LOGGER.error(f"Shutdown: Error stopping scheduler: {e}")
    else:
        LOGGER.info("Shutdown: Local development mode. Scheduler not stopped.")


class FAIApp(FastAPI):
    openapi_schema: dict[str, Any] | None

    def custom_openapi(self) -> Any:
        if self.openapi_schema:
            return self.openapi_schema
        openapi_schema: dict[str, Any] = get_openapi(
            title="FAI",
            version="0.0.0",
            summary="The FAI API.",
            routes=self.routes,
        )

        openapi_schema["servers"] = [
            {"url": "https://fai.buildwithfern.com", "x-fern-server-name": "Production"},
            {"url": "https://fai-dev.buildwithfern.com", "x-fern-server-name": "Development"},
            {"url": "http://localhost:8080", "x-fern-server-name": "Local"},
        ]

        openapi_schema["components"] = openapi_schema.get("components", {})
        openapi_schema["components"]["securitySchemes"] = {
            "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        }

        self.openapi_schema = openapi_schema
        return self.openapi_schema

    def openapi(self) -> Any:
        return self.custom_openapi()


fai_app = FAIApp(lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://www.app.buildwithfern.com",
    "https://app.buildwithfern.com",
    "https://www.app-dev.buildwithfern.com",
    "https://app-dev.buildwithfern.com",
    "https://www.dashboard-dev.buildwithfern.com",
    "https://dashboard-dev.buildwithfern.com",
    "https://www.dashboard.buildwithfern.com",
    "https://dashboard.buildwithfern.com",
]

fai_app.add_middleware(
    CORSMiddleware,
    allow_origins="*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
