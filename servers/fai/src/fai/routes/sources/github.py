import json
import logging
import uuid
from datetime import (
    UTC,
    datetime,
)

import aioboto3
from fastapi import (
    Depends,
    HTTPException,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    strip_domain,
)
from fai.models.api.github_source_api import (
    IndexGithubRequest,
    IndexGithubResponse,
    IndexingCallbackRequest,
    IndexingCallbackResponse,
)
from fai.models.db.index_source_db import (
    IndexSourceDb,
    IndexSourceStatus,
    SourceType,
)
from fai.settings import CONFIG

logger = logging.getLogger(__name__)

LAMBDA_FUNCTION_NAME = "fai-code-indexing-dev2"


@fai_app.post(
    "/sources/github/{domain}/index-with-agent",
    response_model=IndexGithubResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def index_github_source_repos_with_agent(
    domain: str,
    request: IndexGithubRequest,
    db: AsyncSession = Depends(get_db),
) -> IndexGithubResponse:
    """Start indexing a GitHub repository for a domain."""
    try:
        stripped_domain = strip_domain(domain)
        job_id = str(uuid.uuid4())

        domain_root_entry = await db.execute(
            select(IndexSourceDb).where(
                IndexSourceDb.domain == stripped_domain, IndexSourceDb.source_type == SourceType.GITHUB_DOMAIN_ROOT
            )
        )

        domain_root_entry = domain_root_entry.scalar_one_or_none()
        if domain_root_entry is None:
            domain_root_entry = IndexSourceDb(
                domain=stripped_domain,
                source_type=SourceType.GITHUB_DOMAIN_ROOT,
                source_identifier="domain",
                config={},
                status=IndexSourceStatus.ACTIVE,
            )
            db.add(domain_root_entry)
            await db.flush()

        existing_repo_entries = await db.execute(
            select(IndexSourceDb).where(
                IndexSourceDb.domain == stripped_domain,
                IndexSourceDb.source_type == SourceType.GITHUB,
                IndexSourceDb.source_identifier.in_(request.repo_urls),
            )
        )
        existing_repo_urls = {repo.source_identifier for repo in existing_repo_entries.scalars().all()}

        for repo_url in request.repo_urls:
            if repo_url in existing_repo_urls:
                logger.info(f"Repository {repo_url} already exists for domain {stripped_domain}, skipping")
                continue

            index_source = IndexSourceDb(
                domain=stripped_domain,
                source_type=SourceType.GITHUB,
                source_identifier=repo_url,
                config={},
                job_id=job_id,
                status=IndexSourceStatus.INDEXING,
                metrics={},
            )
            db.add(index_source)

        await db.commit()

        session = aioboto3.Session()
        async with session.client("lambda") as lambda_client:
            callback_url = f"{CONFIG.FAI_SERVER_URL}/sources/github/{stripped_domain}/lambda/callback"

            body_payload = {
                "domain": stripped_domain,
                "eventType": "indexRepo",
                "repoUrls": request.repo_urls,
                "callbackUrl": callback_url,
            }

            payload = {"body": json.dumps(body_payload)}

            response = await lambda_client.invoke(
                FunctionName=LAMBDA_FUNCTION_NAME,
                InvocationType="Event",
                Payload=json.dumps(payload),
            )

            logger.info(
                f"Successfully invoked code indexing Lambda. "
                f"StatusCode: {response.get('StatusCode')}, "
                f"Domain: {stripped_domain}, "
                f"RepoUrls: {request.repo_urls}, "
                f"JobId: {job_id}"
            )

    except Exception as e:
        logger.error(f"[github-sources] Unexpected error invoking code indexing Lambda: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start indexing job")

    return IndexGithubResponse(job_id=job_id, repo_urls=request.repo_urls)


@fai_app.post(
    "/sources/github/{domain}/index",
    response_model=IndexGithubResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def index_github_source_repos_markdown(
    domain: str,
    request: IndexGithubRequest,
    db: AsyncSession = Depends(get_db),
) -> IndexGithubResponse:
    """Start indexing markdown files from GitHub repositories for a domain."""
    try:
        stripped_domain = strip_domain(domain)
        job_id = str(uuid.uuid4())

        domain_root_entry = await db.execute(
            select(IndexSourceDb).where(
                IndexSourceDb.domain == stripped_domain, IndexSourceDb.source_type == SourceType.GITHUB_DOMAIN_ROOT
            )
        )

        domain_root_entry = domain_root_entry.scalar_one_or_none()
        if domain_root_entry is None:
            domain_root_entry = IndexSourceDb(
                domain=stripped_domain,
                source_type=SourceType.GITHUB_DOMAIN_ROOT,
                source_identifier="domain",
                config={},
                status=IndexSourceStatus.ACTIVE,
            )
            db.add(domain_root_entry)
            await db.flush()

        existing_repo_entries = await db.execute(
            select(IndexSourceDb).where(
                IndexSourceDb.domain == stripped_domain,
                IndexSourceDb.source_type == SourceType.GITHUB,
                IndexSourceDb.source_identifier.in_(request.repo_urls),
            )
        )
        existing_repo_urls = {repo.source_identifier for repo in existing_repo_entries.scalars().all()}

        for repo_url in request.repo_urls:
            if repo_url in existing_repo_urls:
                logger.info(f"Repository {repo_url} already exists for domain {stripped_domain}, skipping")
                continue

            index_source = IndexSourceDb(
                domain=stripped_domain,
                source_type=SourceType.GITHUB,
                source_identifier=repo_url,
                config={},
                job_id=job_id,
                status=IndexSourceStatus.INDEXING,
                metrics={},
            )
            db.add(index_source)

        await db.commit()

        session = aioboto3.Session()
        async with session.client("lambda") as lambda_client:
            callback_url = f"{CONFIG.FAI_SERVER_URL}/sources/github/{stripped_domain}/lambda/callback"

            body_payload = {
                "domain": stripped_domain,
                "eventType": "indexRepoMarkdown",
                "repoUrls": request.repo_urls,
                "callbackUrl": callback_url,
            }

            payload = {"body": json.dumps(body_payload)}

            response = await lambda_client.invoke(
                FunctionName=LAMBDA_FUNCTION_NAME,
                InvocationType="Event",
                Payload=json.dumps(payload),
            )

            logger.info(
                f"Successfully invoked markdown indexing Lambda. "
                f"StatusCode: {response.get('StatusCode')}, "
                f"Domain: {stripped_domain}, "
                f"RepoUrls: {request.repo_urls}, "
                f"JobId: {job_id}"
            )

    except Exception as e:
        logger.error(f"[github-sources] Unexpected error invoking markdown indexing Lambda: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start indexing job")

    return IndexGithubResponse(job_id=job_id, repo_urls=request.repo_urls)


@fai_app.post(
    "/sources/github/{domain}/lambda/callback",
    response_model=IndexingCallbackResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def indexing_callback(
    domain: str,
    request: IndexingCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> IndexingCallbackResponse:
    stripped_domain = strip_domain(domain)

    logger.info(
        f"Received indexing callback for domain {stripped_domain} "
        f"with session_id: {request.session_id}, status: {request.status}"
    )

    result = await db.execute(
        select(IndexSourceDb).where(
            IndexSourceDb.domain == stripped_domain, IndexSourceDb.source_type == SourceType.GITHUB_DOMAIN_ROOT
        )
    )
    domain_root_entry = result.scalar_one_or_none()

    if not domain_root_entry:
        logger.error(f"[github-sources] No GITHUB_DOMAIN_ROOT entry found for domain {stripped_domain}")
        raise HTTPException(status_code=404, detail="Domain root entry not found")

    if request.session_id:
        domain_root_entry.config = {"sessionId": request.session_id}
        attributes.flag_modified(domain_root_entry, "config")
        domain_root_entry.last_indexed_at = datetime.now(UTC)
        domain_root_entry.updated_at = datetime.now(UTC)

    result = await db.execute(
        select(IndexSourceDb).where(
            IndexSourceDb.domain == stripped_domain, IndexSourceDb.source_type == SourceType.GITHUB
        )
    )
    repo_entries = result.scalars().all()

    new_status = IndexSourceStatus.ACTIVE if request.status == "success" else IndexSourceStatus.FAILED
    now = datetime.now(UTC)

    for repo_entry in repo_entries:
        repo_entry.status = new_status
        repo_entry.last_indexed_at = now
        repo_entry.updated_at = now

    await db.commit()

    logger.info(
        f"Successfully updated {len(repo_entries)} repo entries and domain root "
        f"for domain {stripped_domain} with session_id {request.session_id}"
    )

    return IndexingCallbackResponse(
        status="success",
        status_code=200,
    )
