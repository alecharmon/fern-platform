import uuid
from datetime import datetime

from fastapi import (
    Body,
    Depends,
    HTTPException,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.models.api.connectors.github_api import (
    GitHubFileInfoRequest,
    ReferenceSnippet,
)
from src.fai.models.db.code_db import CodeDb
from src.fai.utils.connectors.github.client import GitHubClient
from src.fai.utils.turbopuffer.sync import sync_code_db_to_tpuf
from src.settings import LOGGER


@fai_app.post("/github/{domain}/reference-md/index", response_model=list[ReferenceSnippet])
async def index_reference_md(
    domain: str,
    body: GitHubFileInfoRequest = Body(...),
    db: AsyncSession = Depends(get_db),
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
            return JSONResponse(status_code=404, content=jsonable_encoder({"message": "reference.md file not found"}))

        code_snippets = gh_client.extract_usage_snippets(result)
        new_db_code_snippets: list[CodeDb] = []

        for snippet in code_snippets[:10]:
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
        return JSONResponse(status_code=200, content=jsonable_encoder({"message": "success"}))

    except ValueError as e:
        LOGGER.error(f"Invalid request: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        LOGGER.error(f"Error retrieving repository source: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve repository source")


def construct_document_from_snippet(snippet: ReferenceSnippet) -> str:
    usage_text = f"\n\n# Example Usage\n{snippet.usage}" if snippet.usage is not None else ""
    return f"# Method Header\n{snippet.method_header}{usage_text}"
