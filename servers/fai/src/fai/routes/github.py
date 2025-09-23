import uuid
from datetime import datetime

from fastapi import (
    Body,
    Depends,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from turbopuffer import AsyncTurbopuffer

from src.fai.app import fai_app
from src.fai.dependencies import (
    get_db,
    verify_token,
)
from src.fai.models.api.connectors.github_api import (
    CodeIndexStatusResponse,
    GitHubFileInfoRequest,
    IndexResponse,
    ReferenceSnippet,
)
from src.fai.models.db.code_db import CodeDb
from src.fai.utils.connectors.github.client import GitHubClient
from src.fai.utils.turbopuffer.namespace import (
    get_code_index_name,
    get_tpuf_namespace,
)
from src.fai.utils.turbopuffer.sync import sync_code_db_to_tpuf
from src.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)


@fai_app.post(
    "/github/{domain}/reference-md/index",
    response_model=IndexResponse,
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def index_reference_md(
    domain: str,
    body: GitHubFileInfoRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """
    Index an SDK repository's reference.md file.
    """
    LOGGER.info(f"Indexing GitHub repository at {body.url} for domain {domain}")
    try:
        gh_client = GitHubClient()
        result = gh_client.retrieve_reference_md_source(body)

        if not result:
            LOGGER.info(f"No reference.md file found for {body.url}")
            return JSONResponse(status_code=404, content=jsonable_encoder({"message": "No reference.md file found"}))

        code_snippets = gh_client.extract_usage_snippets(result)
        new_db_code_snippets: list[CodeDb] = []

        for snippet in code_snippets:
            snippets_document = construct_document_from_snippet(snippet)
            new_db_code_snippet = CodeDb(
                id=str(uuid.uuid4()),
                domain=domain,
                chunk=snippet.description,
                document=snippets_document,
                title=snippet.method_header,
                url=result.html_url,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                keywords=[snippet.language, "code", "sdk", "snippet"],
            )
            new_db_code_snippets.append(new_db_code_snippet)

        await db.execute(CodeDb.__table__.delete().where((CodeDb.domain == domain) & (CodeDb.url == result.html_url)))
        db.add_all(new_db_code_snippets)
        await db.commit()

        await sync_code_db_to_tpuf(domain, db)
        return JSONResponse(status_code=200, content=jsonable_encoder(IndexResponse(success=True)))

    except ValueError as e:
        LOGGER.error(f"Invalid request: {e}")
        return JSONResponse(status_code=400, content=jsonable_encoder(IndexResponse(success=False)))

    except Exception as e:
        LOGGER.error(f"Error retrieving repository source: {e}")
        return JSONResponse(status_code=500, content=jsonable_encoder(IndexResponse(success=False)))


@fai_app.get(
    "/github/{domain}/indexed",
    response_model=CodeIndexStatusResponse,
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def check_code_index_status(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> CodeIndexStatusResponse:
    """
    Check if the domain has a non-empty code index in both database and turbopuffer.
    """
    try:
        db_result = await db.execute(select(func.count(CodeDb.id)).where(CodeDb.domain == domain))
        db_count = db_result.scalar() or 0

        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            namespace_id = get_tpuf_namespace(domain, get_code_index_name())
            namespace = tpuf_client.namespace(namespace_id)
            tpuf_count = (await namespace.metadata()).approx_row_count

        code_index_exists = db_count > 0 and tpuf_count > 0
        return JSONResponse(
            status_code=200, content=jsonable_encoder(CodeIndexStatusResponse(exists=code_index_exists))
        )

    except Exception as e:
        LOGGER.error(f"Error checking code index status for domain {domain}: {e}")
        return JSONResponse(status_code=200, content=jsonable_encoder(CodeIndexStatusResponse(exists=False)))


def construct_document_from_snippet(snippet: ReferenceSnippet) -> str:
    usage_text = f"\n\n# Example Usage\n{snippet.usage}" if snippet.usage is not None else ""
    return f"# Method Header\n{snippet.method_header}{usage_text}"
