import asyncio
import uuid
from datetime import (
    UTC,
    datetime,
)

from fastapi import (
    Body,
    Depends,
    HTTPException,
)
from fastapi import Query as QueryParam
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    ask_ai_enabled,
    get_db,
    verify_token,
)
from fai.models.api.commons.pagination import PaginationResponse
from fai.models.api.website_api import (
    DeleteAllWebsitesResponse,
    DeleteWebsiteRequest,
    DeleteWebsiteResponse,
    GetWebsiteResponse,
    GetWebsitesResponse,
    GetWebsiteStatusResponse,
    IndexWebsiteRequest,
    IndexWebsiteResponse,
    ReindexWebsiteRequest,
    ReindexWebsiteResponse,
)
from fai.models.db.index_source_db import (
    IndexSourceDb,
    SourceType,
)
from fai.models.db.website_db import WebsiteDb
from fai.settings import LOGGER
from fai.utils.jobs import job_manager
from fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_website_index_name,
)
from fai.utils.turbopuffer.sync import (
    delete_websites_from_query_index,
    delete_websites_from_tpuf,
)
from fai.utils.website.jobs import crawl_website_job
from fai.utils.website.models import WebsiteCrawlConfig


@fai_app.post(
    "/sources/website/{domain}/index",
    response_model=IndexWebsiteResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def index_website(
    domain: str,
    body: IndexWebsiteRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    """
    Start crawling and indexing a website.
    Returns a job_id to track the crawling progress.
    """
    LOGGER.info(f"Received request to index website for domain: {domain}, base_url: {body.base_url}")
    try:
        result = await db.execute(
            select(IndexSourceDb).where(
                IndexSourceDb.domain == domain,
                IndexSourceDb.source_type == SourceType.WEBSITE,
                IndexSourceDb.source_identifier == body.base_url,
            )
        )
        index_source = result.scalar_one_or_none()
        if index_source and index_source.status == "indexing":
            LOGGER.info(
                f"Website {body.base_url} is already being indexed for domain: {domain}, returning existing job ID"
            )
            return JSONResponse(
                jsonable_encoder(IndexWebsiteResponse(job_id=index_source.job_id, base_url=body.base_url))
            )

        job_id = await job_manager.create_job(db)

        if index_source:
            index_source.status = "indexing"
            index_source.job_id = job_id
            index_source.config = body.model_dump()
            index_source.updated_at = datetime.now(UTC)
        else:
            source_id = str(uuid.uuid4())
            index_source = IndexSourceDb(
                id=source_id,
                domain=domain,
                source_type=SourceType.WEBSITE,
                source_identifier=body.base_url,
                config=body.model_dump(),
                status="indexing",
                job_id=job_id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(index_source)

        await db.commit()

        # Convert API request to crawl config
        crawl_config = WebsiteCrawlConfig.from_index_request(body)

        asyncio.create_task(
            job_manager.execute_job(job_id, crawl_website_job, job_id, index_source.id, domain, crawl_config)
        )

        LOGGER.info(f"Started website crawl job {job_id} for domain: {domain}, base_url: {body.base_url}")
        return JSONResponse(jsonable_encoder(IndexWebsiteResponse(job_id=job_id, base_url=body.base_url)))

    except Exception as e:
        LOGGER.exception("Failed to start website crawl")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/sources/website/{domain}/status",
    response_model=GetWebsiteStatusResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def get_website_status(
    job_id: str = QueryParam(..., description="The job ID returned from the index endpoint"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    """
    Get the status of a website crawling job.
    """
    try:
        job = await job_manager.get_job_status(db, job_id)

        if not job:
            return JSONResponse(status_code=404, content={"detail": "Job not found"})

        result = await db.execute(select(IndexSourceDb).where(IndexSourceDb.job_id == job_id))
        index_source = result.scalar_one_or_none()

        if not index_source:
            return JSONResponse(status_code=404, content={"detail": "Source not found for this job"})

        metrics = index_source.metrics or {}
        pages_indexed = metrics.get("pages_indexed", 0)
        pages_failed = metrics.get("pages_failed", 0)

        # Determine status: use job status if in progress, otherwise use source status
        if job.status in ["pending", "in_progress"]:
            status = job.status
            error = None
        else:
            status = index_source.status
            error = job.error

        response = GetWebsiteStatusResponse(
            job_id=job.id,
            status=status,
            base_url=index_source.source_identifier,
            pages_indexed=pages_indexed,
            pages_failed=pages_failed,
            error=error,
        )

        return JSONResponse(jsonable_encoder(response))

    except Exception as e:
        LOGGER.exception(f"Failed to get website status for job {job_id}")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/sources/website/{domain}/{website_id}",
    response_model=GetWebsiteResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def get_website_by_id(
    domain: str,
    website_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    """
    Get a single indexed website page by ID.
    """
    try:
        website = await db.execute(select(WebsiteDb).where(WebsiteDb.id == website_id, WebsiteDb.domain == domain))
        website = website.scalar_one_or_none()

        if not website:
            return JSONResponse(status_code=404, content={"detail": "Website not found"})

        return JSONResponse(jsonable_encoder(GetWebsiteResponse(website=website.to_api())))

    except Exception as e:
        LOGGER.exception("Failed to get website")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/sources/website/{domain}",
    response_model=GetWebsitesResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def get_websites(
    domain: str,
    page: int = QueryParam(default=1, description="The page number for pagination"),
    limit: int = QueryParam(default=100, description="The number of sources per page"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    """
    List all indexed website pages for a domain with pagination.
    """
    try:
        if page < 1:
            raise HTTPException(status_code=400, detail="page must be >= 1")
        if limit < 1 or limit > 1000:
            raise HTTPException(status_code=400, detail="limit must be between 1 and 1000")

        offset = (page - 1) * limit

        total_count = await db.scalar(select(func.count()).select_from(WebsiteDb).where(WebsiteDb.domain == domain))

        stmt = select(WebsiteDb).where(WebsiteDb.domain == domain).offset(offset).limit(limit)
        result = await db.execute(stmt)
        websites = result.scalars().all()

        response = GetWebsitesResponse(
            websites=[website.to_api() for website in websites],
            pagination=PaginationResponse(
                total=total_count,
                page=page,
                limit=limit,
            ),
        )

        return JSONResponse(jsonable_encoder(response))

    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    except ValueError as e:
        LOGGER.exception("Bad request when getting websites")
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        LOGGER.exception("Failed to get websites")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/sources/website/{domain}/reindex",
    response_model=ReindexWebsiteResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def reindex_website(
    domain: str,
    body: ReindexWebsiteRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    """
    Re-crawl a website by starting a new crawl job. The job will delete old pages before indexing.
    Uses the configuration from the original index request.
    """
    try:
        result = await db.execute(
            select(IndexSourceDb).where(
                IndexSourceDb.domain == domain,
                IndexSourceDb.source_type == SourceType.WEBSITE,
                IndexSourceDb.source_identifier == body.base_url,
            )
        )
        index_source = result.scalar_one_or_none()

        if not index_source:
            LOGGER.warning(f"Cannot reindex {body.base_url} - website has not been indexed before")
            return JSONResponse(
                status_code=404,
                content={
                    "detail": f"Website {body.base_url} has not been indexed. Please use the index endpoint first."
                },
            )

        if not index_source.config:
            LOGGER.error(f"Index source {index_source.id} has no config stored")
            return JSONResponse(status_code=500, content={"detail": "No configuration found for this website"})

        job_id = await job_manager.create_job(db)

        # Merge stored config with user-provided overrides
        stored_config_dict = index_source.config.copy()

        # Override stored config with any non-None values from the request
        request_dict = body.model_dump(exclude={"base_url"}, exclude_none=True)
        stored_config_dict.update(request_dict)

        # Update the stored config with merged values
        index_source.config = stored_config_dict
        index_source.status = "indexing"
        index_source.job_id = job_id
        index_source.updated_at = datetime.now(UTC)
        index_source.metrics = {}

        await db.commit()

        # Convert merged config to IndexWebsiteRequest and then to WebsiteCrawlConfig
        merged_config = IndexWebsiteRequest(**stored_config_dict)
        crawl_config = WebsiteCrawlConfig.from_index_request(merged_config)

        asyncio.create_task(
            job_manager.execute_job(job_id, crawl_website_job, job_id, index_source.id, domain, crawl_config)
        )

        LOGGER.info(f"Started website re-crawl job {job_id} for domain: {domain}, base_url: {body.base_url}")
        return JSONResponse(jsonable_encoder(ReindexWebsiteResponse(job_id=job_id, base_url=body.base_url)))

    except Exception as e:
        LOGGER.exception("Failed to reindex website")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete(
    "/sources/website/{domain}/delete",
    response_model=DeleteWebsiteResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def delete_website(
    domain: str,
    body: DeleteWebsiteRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    """
    Delete all pages from a specific website by base URL.
    """
    try:
        websites = await db.execute(
            select(WebsiteDb).where(WebsiteDb.domain == domain, WebsiteDb.base_url == body.base_url)
        )
        websites = websites.scalars().all()

        website_ids = [website.id for website in websites]
        pages_deleted = len(websites)

        for website in websites:
            await db.delete(website)

        await db.commit()

        if website_ids:
            await delete_websites_from_tpuf(domain, website_ids)
            await delete_websites_from_query_index(
                domain, website_ids, get_website_index_name(), get_query_index_name()
            )

        LOGGER.info(f"Deleted {pages_deleted} pages from {body.base_url} for domain: {domain}")
        return JSONResponse(jsonable_encoder(DeleteWebsiteResponse(success=True, pages_deleted=pages_deleted)))

    except Exception as e:
        LOGGER.exception("Failed to delete website")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete(
    "/sources/website/{domain}/delete-all",
    response_model=DeleteAllWebsitesResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def delete_all_websites(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    """
    Delete all indexed website pages for a domain.
    """
    try:
        websites = await db.execute(select(WebsiteDb).where(WebsiteDb.domain == domain))
        websites = websites.scalars().all()

        website_ids = [website.id for website in websites]
        pages_deleted = len(websites)

        for website in websites:
            await db.delete(website)

        await db.commit()

        if website_ids:
            await delete_websites_from_tpuf(domain, website_ids)
            await delete_websites_from_query_index(
                domain, website_ids, get_website_index_name(), get_query_index_name()
            )

        LOGGER.info(f"Deleted all {pages_deleted} website pages for domain: {domain}")
        return JSONResponse(jsonable_encoder(DeleteAllWebsitesResponse(success=True, pages_deleted=pages_deleted)))

    except Exception as e:
        LOGGER.exception("Failed to delete all websites")
        return JSONResponse(status_code=500, content={"detail": str(e)})
