from datetime import datetime

from pydantic import BaseModel


class ReindexingJobRecord(BaseModel):
    """Reindexing job record model"""

    domain: str
    status: str
    memory_mb: int
    retry_count: int
    task_arn: str | None = None
    sqs_message_id: str | None = None
    started_at: datetime | None = None
    updated_at: datetime
    completed_at: datetime | None = None
    duration_ms: int | None = None
    num_inserted: int | None = None
    error: str | None = None
    reason: str | None = None
    task_arns: list[str] | None = None


class UpdateReindexingJobStatusResponse(BaseModel):
    """Response model for updating reindexing job status"""

    success: bool
    domain: str
    status: str
