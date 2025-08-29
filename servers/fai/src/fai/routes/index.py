from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from src.fai.app import fai_app
from src.fai.models.api.index_api import (
    ReconstructIndexResponse,
    SyncIndexRequest,
    SyncIndexResponse,
)
from src.fai.utils.turbopuffer.namespace import get_query_index_name
from src.fai.utils.turbopuffer.reconstruct import reconstruct_query_index_for_domain
from src.fai.utils.turbopuffer.sync import sync_index_to_target
from src.settings import LOGGER


@fai_app.post("/index/{domain}/reconstruct", response_model=ReconstructIndexResponse)
async def reconstruct_query_index(
    domain: str,
) -> JSONResponse:
    try:
        await reconstruct_query_index_for_domain(domain)
        return JSONResponse(jsonable_encoder(ReconstructIndexResponse(success=True)))

    except Exception as e:
        LOGGER.exception("Failed to reconstruct index")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post("/index/{domain}/sync", response_model=SyncIndexResponse)
async def sync_index_to_query_index(
    domain: str,
    body: SyncIndexRequest,
) -> JSONResponse:
    try:
        await sync_index_to_target(domain, body.index_name, get_query_index_name())
        return JSONResponse(jsonable_encoder(SyncIndexResponse(success=True)))

    except Exception as e:
        LOGGER.exception("Failed to sync index")
        return JSONResponse(status_code=500, content={"detail": str(e)})
