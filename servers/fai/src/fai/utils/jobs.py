import uuid
from collections.abc import (
    Awaitable,
    Callable,
)
from concurrent.futures import ThreadPoolExecutor
from datetime import (
    UTC,
    datetime,
)
from enum import Enum
from typing import Any

from sqlalchemy import (
    select,
    update,
)

from src.fai.db import async_session_maker
from src.fai.models.db.job_db import JobDb
from src.settings import LOGGER


class JobStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class JobManager:
    def __init__(self, max_workers: int = 4):
        self._executor = ThreadPoolExecutor(max_workers=max_workers)

    async def create_job(self) -> str:
        job_id = str(uuid.uuid4())

        async with async_session_maker() as session:
            job = JobDb(id=job_id, status=JobStatus.PENDING, created_at=datetime.now(UTC))
            session.add(job)
            await session.commit()

        LOGGER.info(f"Created job {job_id}")
        return job_id

    async def execute_job(self, job_id: str, func: Callable[..., Awaitable[Any]], *args: Any, **kwargs: Any) -> None:
        async with async_session_maker() as session:
            await session.execute(
                update(JobDb)
                .where(JobDb.id == job_id)
                .values(status=JobStatus.IN_PROGRESS, started_at=datetime.now(UTC))
            )
            await session.commit()

        LOGGER.info(f"Starting job {job_id}")

        try:
            await func(*args, **kwargs)

            async with async_session_maker() as session:
                await session.execute(
                    update(JobDb)
                    .where(JobDb.id == job_id)
                    .values(status=JobStatus.COMPLETED, completed_at=datetime.now(UTC))
                )
                await session.commit()

            LOGGER.info(f"Job {job_id} completed successfully")

        except Exception as e:
            async with async_session_maker() as session:
                await session.execute(
                    update(JobDb)
                    .where(JobDb.id == job_id)
                    .values(status=JobStatus.FAILED, completed_at=datetime.now(UTC), error=str(e))
                )
                await session.commit()

            LOGGER.exception(f"Job {job_id} failed: {e}")

    async def get_job_status(self, job_id: str) -> JobDb | None:
        async with async_session_maker() as session:
            result = await session.execute(select(JobDb).where(JobDb.id == job_id))
            return result.scalar_one_or_none()

    async def cleanup_old_jobs(self, max_age_hours: int = 24) -> None:
        cutoff_timestamp = datetime.now(UTC).timestamp() - (max_age_hours * 3600)
        cutoff_datetime = datetime.fromtimestamp(cutoff_timestamp, tz=UTC)

        async with async_session_maker() as session:
            result = await session.execute(select(JobDb).where(JobDb.created_at < cutoff_datetime))
            old_jobs = result.scalars().all()
            LOGGER.info(f"Found {len(old_jobs)} old jobs to potentially clean up")


job_manager = JobManager()
