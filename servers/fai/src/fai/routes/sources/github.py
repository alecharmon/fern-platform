from fastapi import Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    strip_domain,
    verify_token,
)
from fai.models.api.github_source_api import (
    GithubIndexStatusResponse,
    IndexGithubRequest,
    IndexGithubResponse,
    ReindexGithubRequest,
    ReindexGithubResponse,
)


@fai_app.post(
    "/sources/github/{domain}/index",
    response_model=IndexGithubResponse,
    dependencies=[Depends(verify_token)],
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def index_github_source(
    domain: str,
    request: IndexGithubRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Start indexing a GitHub repository for a domain."""
    strip_domain(domain)

    # TODO: Implement GitHub indexing logic
    # - Create IndexSourceDb record
    # - Start background indexing job
    # - Return job_id and repo_url

    raise NotImplementedError("GitHub indexing not yet implemented")


@fai_app.get(
    "/sources/github/{domain}/status",
    response_model=GithubIndexStatusResponse,
    dependencies=[Depends(verify_token)],
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_github_index_status(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Get the indexing status for a GitHub repository."""
    strip_domain(domain)

    # TODO: Implement status check logic
    # - Query IndexSourceDb for the domain
    # - Return current status and metrics

    raise NotImplementedError("GitHub status check not yet implemented")


@fai_app.post(
    "/sources/github/{domain}/reindex",
    response_model=ReindexGithubResponse,
    dependencies=[Depends(verify_token)],
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def reindex_github_source(
    domain: str,
    request: ReindexGithubRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Delete existing index and start a new indexing job for a GitHub repository."""
    strip_domain(domain)

    # TODO: Implement reindexing logic
    # - Delete old IndexSourceDb records and indexed content
    # - Create new IndexSourceDb record
    # - Start new background indexing job
    # - Return new job_id

    raise NotImplementedError("GitHub reindexing not yet implemented")
