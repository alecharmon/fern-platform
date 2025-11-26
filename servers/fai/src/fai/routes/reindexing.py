from datetime import datetime

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    verify_token,
)
from fai.models.types.reindexing_types import (
    ReindexingJobRecord,
    UpdateReindexingJobStatusResponse,
)
from fai.settings import LOGGER
from fai.utils.reindexing import (
    get_job_record,
    update_job_status,
)


@fai_app.get(
    "/reindexing/{domain}/status",
    response_model=ReindexingJobRecord,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_reindexing_job_status(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Get the status of a reindexing job for a domain"""
    try:
        record = await get_job_record(db, domain)

        if not record:
            return JSONResponse(
                status_code=404,
                content={"domain": domain, "status": None, "message": "No job found for this domain"},
            )

        response = ReindexingJobRecord(
            domain=record.domain,
            status=record.status,
            memory_mb=record.memory_mb,
            retry_count=record.retry_count,
            task_arn=record.task_arn,
            sqs_message_id=record.sqs_message_id,
            started_at=record.started_at,
            updated_at=record.updated_at,
            completed_at=record.completed_at,
            duration_ms=record.duration_ms,
            num_inserted=record.num_inserted,
            error=record.error,
            reason=record.reason,
            task_arns=record.task_arns or [],
        )

        return JSONResponse(jsonable_encoder(response))

    except Exception as e:
        LOGGER.exception(f"Failed to get reindexing job status for {domain}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@fai_app.post(
    "/reindexing/{domain}/status",
    response_model=UpdateReindexingJobStatusResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def update_reindexing_job_status_endpoint(
    domain: str,
    status: str,
    memory_mb: int | None = None,
    retry_count: int | None = None,
    task_arn: str | None = None,
    sqs_message_id: str | None = None,
    completed_at: str | None = None,
    duration_ms: int | None = None,
    num_inserted: int | None = None,
    error: str | None = None,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Update the status of a reindexing job"""
    try:
        completed_at_dt = datetime.fromisoformat(completed_at) if completed_at else None

        await update_job_status(
            db=db,
            domain=domain,
            status=status,
            memory_mb=memory_mb,
            retry_count=retry_count,
            task_arn=task_arn,
            sqs_message_id=sqs_message_id,
            completed_at=completed_at_dt,
            duration_ms=duration_ms,
            num_inserted=num_inserted,
            error=error,
            reason=reason,
        )

        return JSONResponse(
            jsonable_encoder(UpdateReindexingJobStatusResponse(success=True, domain=domain, status=status))
        )

    except Exception as e:
        LOGGER.exception(f"Failed to update reindexing job status for {domain}")
        return JSONResponse(status_code=500, content={"error": str(e)})
