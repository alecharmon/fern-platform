import importlib
import pkgutil

import uvicorn
from fastapi.routing import APIRoute

import fai.routes
from fai.app import fai_app
from fai.settings import (
    LOGGER,
    VARIABLES,
)

ROUTES_PACKAGE_NAME = "fai.routes"

for _, module_name, is_pkg in pkgutil.iter_modules(fai.routes.__path__):
    full_module_name = f"{ROUTES_PACKAGE_NAME}.{module_name}"
    importlib.import_module(full_module_name)


def _infer_module_tag(endpoint_module: str) -> str | None:
    if not endpoint_module:
        return None

    prefix = f"{ROUTES_PACKAGE_NAME}."
    if endpoint_module.startswith(prefix):
        remainder = endpoint_module[len(prefix) :]
        return remainder.split(".", 1)[0].title() if remainder else None
    return None


for route in fai_app.routes:
    if isinstance(route, APIRoute):
        mod = getattr(route.endpoint, "__module__", "")
        tag = _infer_module_tag(mod)
        if tag and tag not in route.tags:
            route.tags.append(tag)


def start() -> None:
    LOGGER.info("Setup: Starting environment variable validation...")
    VARIABLES.validate_env_variables()
    LOGGER.info("Setup: Environment variables validated.")

    LOGGER.info("Setup: Importing all FastAPI routes...")
    for _, module_name, _ in pkgutil.iter_modules(fai.routes.__path__):
        full_module_name = f"{ROUTES_PACKAGE_NAME}.{module_name}"
        importlib.import_module(full_module_name)

    for route in fai_app.routes:
        LOGGER.info(f"{route.path} -> {route.methods}")

    LOGGER.info("Starting FastAPI application...")
    uvicorn.run(
        "fai.main:fai_app",
        host="0.0.0.0",
        port=8080,
        server_header=False,
        reload=True,
        reload_dirs=["src"],
    )


if __name__ == "__main__":
    start()
