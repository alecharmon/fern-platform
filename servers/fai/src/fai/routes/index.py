from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from src.fai.app import fai_app
from src.fai.utils.turbopuffer.namespace import get_query_index_name
from src.fai.utils.turbopuffer.reconstruct import reconstruct_query_index_for_domain
from src.fai.utils.turbopuffer.sync import sync_index_to_target
from src.settings import LOGGER


@fai_app.post("/index/{domain}/reconstruct")
async def reconstruct_query_index(
    domain: str,
) -> JSONResponse:
    try:
        await reconstruct_query_index_for_domain(domain)
        return JSONResponse(content=jsonable_encoder({"message": "Index reconstructed successfully"}))

    except Exception as e:
        LOGGER.exception("Failed to reconstruct index")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post("/index/{domain}/sync")
async def sync_index_to_query_index(
    domain: str,
    index_name: str,
) -> JSONResponse:
    try:
        await sync_index_to_target(domain, index_name, get_query_index_name())
        return JSONResponse(content=jsonable_encoder({"message": "Index synced successfully"}))

    except Exception as e:
        LOGGER.exception("Failed to sync index")
        return JSONResponse(status_code=500, content={"detail": str(e)})
