from fastapi import Body
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from src.fai.app import fai_app
from src.fai.utils.chat.retrieve.v1_retrieve import v1_retrieve
from src.fai.utils.chat.retrieve.v2_retrieve import v2_retrieve
from src.settings import LOGGER


@fai_app.post("/retrieve/v1/{domain}")
async def retrieve_v1(
    domain: str,
    query: str = Body(...),
) -> JSONResponse:
    LOGGER.info(f"Retrieving for domain {domain}")
    try:
        rag_records = await v1_retrieve(query, domain)
        return JSONResponse(content=jsonable_encoder(rag_records))

    except Exception as e:
        LOGGER.exception(f"Failed to retrieve for domain {domain}")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post("/retrieve/v2/{domain}")
async def retrieve_v2(
    domain: str,
    query: str = Body(...),
) -> JSONResponse:
    LOGGER.info(f"Retrieving for domain {domain}")
    try:
        rag_records = await v2_retrieve(query, domain)
        return JSONResponse(content=jsonable_encoder(rag_records))

    except Exception as e:
        LOGGER.exception(f"Failed to retrieve for domain {domain}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
