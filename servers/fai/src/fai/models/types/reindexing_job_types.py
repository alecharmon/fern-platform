from datetime import datetime

from pydantic import BaseModel

from fai.models.enums.reindexing_enums import ReindexingJobStatus


class ReindexingJobRecord(BaseModel):
    """Reindexing job record model (1-to-1 with SQS messages)"""

    id: str
    sqs_message_id: str | None = None
    domain: str
    basepath: str | None = None
    force_full_reindex: bool = False
    status: ReindexingJobStatus
    memory_mb: int | None = None
    retry_count: int = 0
    task_arn: str | None = None
    task_arns: list[str] | None = None
    error: str | None = None
    reason: str | None = None
    num_inserted: int | None = None
    duration_ms: int | None = None
    job_total_time_ms: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    updated_at: datetime
    completed_at: datetime | None = None


class CreateReindexingJobRequest(BaseModel):
    """Request to create a new reindexing job"""

    domain: str
    basepath: str | None = None
    force_full_reindex: bool = False


class CreateReindexingJobResponse(BaseModel):
    """Response after creating a reindexing job"""

    success: bool
    job_id: str | None = None
    sqs_message_id: str | None = None


class UpdateReindexingJobResponse(BaseModel):
    """Response after updating a reindexing job"""

    success: bool
    job_id: str
    status: ReindexingJobStatus | None = None
