import importlib
import pkgutil

import uvicorn
from fastapi.routing import APIRoute

from src.fai.app import fai_app
from src.settings import (
    LOGGER,
    VARIABLES,
)

ROUTES_PACKAGE_NAME = "src.fai.routes"

LOGGER.info("Setup: Importing all FastAPI routes...")
for _, module_name, is_pkg in pkgutil.iter_modules([ROUTES_PACKAGE_NAME.replace(".", "/")]):
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

for route in fai_app.routes:
    if isinstance(route, APIRoute):
        LOGGER.info(f"{route.path} -> {route.methods} | tags={getattr(route, 'tags', [])}")
    else:
        LOGGER.info(f"{type(route).__name__} route | tags={getattr(route, 'tags', [])}")


def start() -> None:
    """Launched with `poetry run start` at root level"""

    LOGGER.info("Setup: Starting environment variable validation...")
    VARIABLES.validate_env_variables()
    LOGGER.info("Setup: Environment variables validated.")

    LOGGER.info("Setup: Importing all FastAPI routes...")
    for _, module_name, _ in pkgutil.iter_modules([ROUTES_PACKAGE_NAME.replace(".", "/")]):
        full_module_name = f"{ROUTES_PACKAGE_NAME}.{module_name}"
        importlib.import_module(full_module_name)

    for route in fai_app.routes:
        LOGGER.info(f"{route.path} -> {route.methods}")

    LOGGER.info("Starting FastAPI application...")
    uvicorn.run(
        "src.fai.main:fai_app",
        host="0.0.0.0",
        port=8080,
        server_header=False,
        reload=VARIABLES.IS_LOCAL,
        reload_dirs=["src"],
    )


if __name__ == "__main__":
    start()
