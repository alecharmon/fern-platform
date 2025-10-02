from collections.abc import AsyncGenerator
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from fai.scheduler import (
    start_scheduler,
    stop_scheduler,
)
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from utils.init_db import init


async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if VARIABLES.IS_LOCAL:
        LOGGER.info("Setup: Local development mode. Initializing database...")
        try:
            await init()
            LOGGER.info("Setup: Database initialized.")
        except Exception as e:
            LOGGER.error(f"Setup: Error initializing database: {e}")
            raise e
    else:
        LOGGER.info("Setup: Production mode. Database not initialized.")

    try:
        start_scheduler()
        LOGGER.info("Setup: Scheduler started.")
    except Exception as e:
        LOGGER.error(f"Setup: Error starting scheduler: {e}")

    yield

    try:
        stop_scheduler()
        LOGGER.info("Shutdown: Scheduler stopped.")
    except Exception as e:
        LOGGER.error(f"Shutdown: Error stopping scheduler: {e}")


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
