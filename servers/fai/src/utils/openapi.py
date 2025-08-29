import importlib
import json

from fastapi import FastAPI
from fastapi.routing import APIRoute

MODULE_PATH = "src.fai.main"
APP_NAME = "fai_app"

OPENAPI_OUTPUT_PATH = "../../fern/apis/fai/openapi.json"


def set_operation_ids(app: FastAPI) -> None:
    for route in app.routes:
        if isinstance(route, APIRoute):
            route.operation_id = route.name


def openapi() -> None:
    mod = importlib.import_module(MODULE_PATH)
    app_obj = getattr(mod, APP_NAME)

    set_operation_ids(app_obj)

    schema = app_obj.openapi()
    with open(OPENAPI_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)
