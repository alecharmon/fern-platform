from datetime import datetime

from pydantic import (
    BaseModel,
    Field,
)


class ReconstructIndexResponse(BaseModel):
    success: bool = Field(description="Whether the query index reconstruction was successful")


class SyncIndexRequest(BaseModel):
    index_name: str = Field(description="The name of the index to sync")


class SyncIndexIncrementalRequest(BaseModel):
    index_name: str = Field(description="The name of the index to sync")
    parent_ids: list[str] = Field(description="List of parent_ids to incrementally sync")


class SyncIndexResponse(BaseModel):
    job_id: str = Field(description="The ID of the sync job")


class JobStatusResponse(BaseModel):
    job_id: str = Field(description="The job ID")
    status: str = Field(description="Current status of the job")
    created_at: datetime = Field(description="When the job was created")
    started_at: datetime | None = Field(default=None, description="When the job started")
    completed_at: datetime | None = Field(default=None, description="When the job completed")
    success: bool | None = Field(default=None, description="Whether the job succeeded (only set when completed)")
    error: str | None = Field(default=None, description="Error message if the job failed")
