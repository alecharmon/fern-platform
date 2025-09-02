import uuid
from collections.abc import (
    Awaitable,
    Callable,
)
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import (
    UTC,
    datetime,
)
from enum import Enum
from typing import (
    Any,
)

from src.settings import LOGGER


class JobStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    status: JobStatus
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: Any | None = None
    error: str | None = None


class JobManager:
    def __init__(self, max_workers: int = 4):
        self._jobs: dict[str, Job] = {}
        self._executor = ThreadPoolExecutor(max_workers=max_workers)

    def create_job(self) -> str:
        job_id = str(uuid.uuid4())
        job = Job(id=job_id, status=JobStatus.PENDING, created_at=datetime.now(UTC))
        self._jobs[job_id] = job
        LOGGER.info(f"Created job {job_id}")
        return job_id

    async def execute_job(self, job_id: str, func: Callable[..., Awaitable[Any]], *args: Any, **kwargs: Any) -> None:
        if job_id not in self._jobs:
            raise ValueError(f"Job {job_id} not found")

        job = self._jobs[job_id]
        job.status = JobStatus.IN_PROGRESS
        job.started_at = datetime.now(UTC)

        LOGGER.info(f"Starting job {job_id}")

        try:
            result: Any = await func(*args, **kwargs)

            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now(UTC)
            job.result = result
            LOGGER.info(f"Job {job_id} completed successfully")

        except Exception as e:
            job.status = JobStatus.FAILED
            job.completed_at = datetime.now(UTC)
            job.error = str(e)
            LOGGER.exception(f"Job {job_id} failed: {e}")

    def get_job_status(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def cleanup_old_jobs(self, max_age_hours: int = 24) -> None:
        cutoff = datetime.now(UTC).timestamp() - (max_age_hours * 3600)
        jobs_to_remove = []

        for job_id, job in self._jobs.items():
            if job.created_at.timestamp() < cutoff:
                jobs_to_remove.append(job_id)

        for job_id in jobs_to_remove:
            del self._jobs[job_id]
            LOGGER.info(f"Cleaned up old job {job_id}")


job_manager = JobManager()
