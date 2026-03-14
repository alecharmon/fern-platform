from datetime import datetime

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    verify_org_token,
    verify_token,
)
from fai.models.db.reindexing_job_db import ReindexingJobDb
from fai.models.enums.reindexing_enums import ReindexingJobStatus
from fai.models.types.reindexing_job_types import (
    CreateReindexingJobRequest,
    CreateReindexingJobResponse,
    ReindexingJobRecord,
    UpdateReindexingJobResponse,
)
from fai.settings import LOGGER
from fai.utils.reindexing.reindexing_job_operations import (
    create_job,
    get_job_by_id,
    get_job_by_task_arn,
    get_latest_job_for_domain,
    get_running_job_for_domain,
    mark_stale_jobs_failed,
    set_sqs_message_id,
    update_job_status,
)


def _job_to_record(job: ReindexingJobDb) -> ReindexingJobRecord:
    """Convert a ReindexingJobDb to a ReindexingJobRecord."""
    return ReindexingJobRecord(
        id=job.id,
        sqs_message_id=job.sqs_message_id,
        domain=job.domain,
        basepath=job.basepath,
        force_full_reindex=job.force_full_reindex,
        status=job.status,
        memory_mb=job.memory_mb,
        retry_count=job.retry_count,
        task_arns=job.task_arns or [],
        error=job.error,
        reason=job.reason,
        num_inserted=job.num_inserted,
        job_total_time_ms=job.job_total_time_ms,
        created_at=job.created_at,
        started_at=job.started_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
    )


@fai_app.post(
    "/reindexing/jobs",
    response_model=CreateReindexingJobResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def create_reindexing_job(
    request: CreateReindexingJobRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_org_token),
) -> JSONResponse:
    """Create a new reindexing job (called before sending SQS message)."""
    try:
        job = await create_job(
            db=db,
            domain=request.domain,
            basepath=request.basepath,
            force_full_reindex=request.force_full_reindex,
        )

        return JSONResponse(
            jsonable_encoder(
                CreateReindexingJobResponse(
                    success=True,
                    job_id=job.id,
                )
            )
        )
    except Exception as e:
        LOGGER.exception("Failed to create reindexing job")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.post(
    "/reindexing/jobs/{job_id}/sqs-message-id",
    response_model=UpdateReindexingJobResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def set_job_sqs_message_id(
    job_id: str,
    sqs_message_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_org_token),
) -> JSONResponse:
    """Set the SQS message ID on a job after sending the SQS message."""
    try:
        await set_sqs_message_id(db=db, job_id=job_id, sqs_message_id=sqs_message_id)
        return JSONResponse(
            jsonable_encoder(UpdateReindexingJobResponse(success=True, job_id=job_id))
        )
    except Exception as e:
        LOGGER.exception(f"Failed to set SQS message ID on job {job_id}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.get(
    "/reindexing/jobs/{job_id}",
    response_model=ReindexingJobRecord,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_reindexing_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_org_token),
) -> JSONResponse:
    """Get a reindexing job by ID."""
    try:
        job = await get_job_by_id(db, job_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"No job found with id {job_id}"})
        return JSONResponse(jsonable_encoder(_job_to_record(job)))
    except Exception as e:
        LOGGER.exception("Failed to get reindexing job")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.get(
    "/reindexing/jobs/domain/{domain}/latest",
    response_model=ReindexingJobRecord,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_latest_reindexing_job(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Get the latest reindexing job for a domain."""
    try:
        job = await get_latest_job_for_domain(db, domain)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"No job found for domain {domain}"})
        return JSONResponse(jsonable_encoder(_job_to_record(job)))
    except Exception as e:
        LOGGER.exception("Failed to get latest reindexing job")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.get(
    "/reindexing/jobs/domain/{domain}/running",
    response_model=ReindexingJobRecord | None,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_running_reindexing_job(
    domain: str,
    basepath: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Get the currently running reindexing job for a domain+basepath, if any."""
    try:
        job = await get_running_job_for_domain(db, domain, basepath)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"No running job for domain {domain}"})
        return JSONResponse(jsonable_encoder(_job_to_record(job)))
    except Exception as e:
        LOGGER.exception("Failed to get running reindexing job")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.get(
    "/reindexing/jobs/task-arn",
    response_model=ReindexingJobRecord,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_reindexing_job_by_task_arn(
    task_arn: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_org_token),
) -> JSONResponse:
    """Get a reindexing job by task ARN."""
    try:
        job = await get_job_by_task_arn(db, task_arn)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"No job found for task ARN {task_arn}"})
        return JSONResponse(jsonable_encoder(_job_to_record(job)))
    except Exception as e:
        LOGGER.exception("Failed to get reindexing job by task ARN")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.post(
    "/reindexing/jobs/{job_id}/status",
    response_model=UpdateReindexingJobResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def update_reindexing_job_status(
    job_id: str,
    status: ReindexingJobStatus,
    memory_mb: int | None = None,
    retry_count: int | None = None,
    task_arn: str | None = None,
    sqs_message_id: str | None = None,
    completed_at: str | None = None,
    num_inserted: int | None = None,
    error: str | None = None,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_org_token),
) -> JSONResponse:
    """Update the status of a reindexing job."""
    try:
        completed_at_dt = datetime.fromisoformat(completed_at) if completed_at else None

        await update_job_status(
            db=db,
            job_id=job_id,
            status=status,
            memory_mb=memory_mb,
            retry_count=retry_count,
            task_arn=task_arn,
            sqs_message_id=sqs_message_id,
            completed_at=completed_at_dt,
            num_inserted=num_inserted,
            error=error,
            reason=reason,
        )

        return JSONResponse(
            jsonable_encoder(UpdateReindexingJobResponse(success=True, job_id=job_id, status=status))
        )
    except Exception as e:
        LOGGER.exception(f"Failed to update reindexing job {job_id}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.post(
    "/reindexing/jobs/domain/{domain}/mark-stale-failed",
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def mark_stale_jobs_failed_endpoint(
    domain: str,
    basepath: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Mark stale running jobs as failed for a domain+basepath."""
    try:
        count = await mark_stale_jobs_failed(db, domain, basepath)
        return JSONResponse(content={"success": True, "marked_failed": count})
    except Exception as e:
        LOGGER.exception(f"Failed to mark stale jobs as failed for {domain}")
        return JSONResponse(status_code=500, content={"error": str(e)})
