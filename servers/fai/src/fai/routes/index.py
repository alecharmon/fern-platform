import asyncio

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from src.fai.app import fai_app
from src.fai.models.api.index_api import (
    JobStatusResponse,
    ReconstructIndexResponse,
    SyncIndexRequest,
    SyncIndexResponse,
)
from src.fai.utils.jobs import (
    JobStatus,
    job_manager,
)
from src.fai.utils.turbopuffer.namespace import get_query_index_name
from src.fai.utils.turbopuffer.reconstruct import reconstruct_query_index_for_domain
from src.fai.utils.turbopuffer.sync import sync_index_to_target
from src.settings import LOGGER


@fai_app.post(
    "/index/{domain}/reconstruct",
    response_model=ReconstructIndexResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def reconstruct_query_index(
    domain: str,
) -> JSONResponse:
    try:
        await reconstruct_query_index_for_domain(domain)
        return JSONResponse(jsonable_encoder(ReconstructIndexResponse(success=True)))

    except Exception as e:
        LOGGER.exception("Failed to reconstruct index")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/index/{domain}/sync", response_model=SyncIndexResponse, openapi_extra={"x-fern-audiences": ["internal"]}
)
async def sync_index_to_query_index(
    domain: str,
    body: SyncIndexRequest,
) -> JSONResponse:
    try:
        job_id = await job_manager.create_job()

        asyncio.create_task(
            job_manager.execute_job(job_id, sync_index_to_target, domain, body.index_name, get_query_index_name())
        )

        return JSONResponse(jsonable_encoder(SyncIndexResponse(job_id=job_id)))

    except Exception as e:
        LOGGER.exception("Failed to create sync job")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/jobs/{job_id}/status", response_model=JobStatusResponse, openapi_extra={"x-fern-audiences": ["internal"]}
)
async def get_job_status(job_id: str) -> JSONResponse:
    try:
        job = await job_manager.get_job_status(job_id)
        if not job:
            return JSONResponse(status_code=404, content={"detail": "Job not found"})

        success = None
        if job.status == JobStatus.COMPLETED:
            success = True
        elif job.status == JobStatus.FAILED:
            success = False

        response = JobStatusResponse(
            job_id=job.id,
            status=job.status,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            success=success,
            error=job.error,
        )

        return JSONResponse(jsonable_encoder(response))

    except Exception as e:
        LOGGER.exception(f"Failed to get job status for {job_id}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
