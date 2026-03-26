from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    verify_token,
)
from fai.models.db.reindexing_job_db import ReindexingJobDb
from fai.models.types.reindexing_types import (
    ReindexingJobRecord,
    UpdateReindexingJobStatusResponse,
)
from fai.settings import LOGGER
from fai.utils.reindexing.reindexing_job_operations import (
    get_job_by_task_arn,
    get_latest_job_for_domain,
)


def _job_to_legacy_record(job: ReindexingJobDb) -> ReindexingJobRecord:
    """Convert a ReindexingJobDb to the legacy ReindexingJobRecord shape."""
    return ReindexingJobRecord(
        domain=job.domain,
        status=job.status,
        memory_mb=job.memory_mb or 0,
        retry_count=job.retry_count or 0,
        sqs_message_id=job.sqs_message_id,
        started_at=job.started_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
        num_inserted=job.num_inserted,
        error=job.error,
        reason=job.reason,
        task_arns=job.task_arns or [],
    )


@fai_app.get(
    "/reindexing/{domain}/status",
    response_model=ReindexingJobRecord,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
    deprecated=True,
)
async def get_reindexing_job_status_by_domain(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Deprecated: use GET /reindexing/jobs/domain/{domain}/latest instead.

    Returns the latest reindexing job for the domain from the reindexing_jobs table.
    """
    try:
        record = await get_latest_job_for_domain(db, domain)

        if not record:
            return JSONResponse(
                status_code=404,
                content={"error": f"No job found for domain {domain}"},
            )

        return JSONResponse(jsonable_encoder(_job_to_legacy_record(record)))

    except Exception as e:
        LOGGER.exception("Failed to get reindexing job status")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.get(
    "/reindexing/status/arn",
    response_model=ReindexingJobRecord,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
    deprecated=True,
)
async def get_reindexing_job_status_by_task_arn(
    task_arn: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Deprecated: use GET /reindexing/jobs/task-arn instead.

    Returns the job matching the task ARN from the reindexing_jobs table.
    """
    try:
        record = await get_job_by_task_arn(db, task_arn)

        if not record:
            return JSONResponse(
                status_code=404,
                content={"error": f"No job found for task ARN {task_arn}"},
            )

        return JSONResponse(jsonable_encoder(_job_to_legacy_record(record)))

    except Exception as e:
        LOGGER.exception("Failed to get reindexing job status")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.post(
    "/reindexing/{domain}/status",
    response_model=UpdateReindexingJobStatusResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
    deprecated=True,
)
async def update_reindexing_job_status(
    domain: str,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    **_kwargs: object,
) -> JSONResponse:
    """Deprecated: use POST /reindexing/jobs/{job_id}/status instead.

    This endpoint is a no-op stub kept for backwards compatibility.
    """
    LOGGER.warning(f"Deprecated endpoint POST /reindexing/{domain}/status called — this is now a no-op")
    return JSONResponse(
        jsonable_encoder(UpdateReindexingJobStatusResponse(success=True, domain=domain, status=status or "unknown"))
    )
