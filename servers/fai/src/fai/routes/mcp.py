from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from fai.app import fai_app
from fai.dependencies import verify_token
from fai.models.api.mcp_api import (
    GetMcpBmfQueryRequest,
    GetMcpBmfQueryResponse,
    GetMcpSemanticQueryRequest,
    GetMcpSemanticQueryResponse,
)
from fai.settings import LOGGER
from fai.utils.search.bm25 import bm25_search
from fai.utils.search.semantic import semantic_search


@fai_app.post(
    "/mcp/semantic/{domain}",
    response_model=GetMcpSemanticQueryResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_mcp_semantic_query(
    domain: str,
    body: GetMcpSemanticQueryRequest,
    _: None = Depends(verify_token),
) -> JSONResponse:
    try:
        documents = await semantic_search(body.semantic_query, domain)
        return JSONResponse(jsonable_encoder(GetMcpSemanticQueryResponse(documents=documents)))

    except Exception as e:
        LOGGER.exception("Failed to get MCP semantic query")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/mcp/bmf/{domain}",
    response_model=GetMcpBmfQueryResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_mcp_bmf_query(
    domain: str,
    body: GetMcpBmfQueryRequest,
    _: None = Depends(verify_token),
) -> JSONResponse:
    try:
        documents = await bm25_search(body.keywords, domain)
        return JSONResponse(jsonable_encoder(GetMcpBmfQueryResponse(documents=documents)))

    except Exception as e:
        LOGGER.exception("Failed to get MCP BMF query")
        return JSONResponse(status_code=500, content={"detail": str(e)})
