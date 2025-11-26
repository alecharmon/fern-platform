from datetime import (
    UTC,
    datetime,
)

from sqlalchemy import (
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.reindexing_metadata_db import ReindexingMetadataDb
from fai.models.enums.reindexing_enums import ReindexingJobStatus
from fai.settings import LOGGER


async def get_job_record_by_domain(db: AsyncSession, domain: str) -> ReindexingMetadataDb | None:
    """Get job record by domain"""
    try:
        result = await db.execute(select(ReindexingMetadataDb).where(ReindexingMetadataDb.domain == domain))
        return result.scalar_one_or_none()
    except Exception as e:
        LOGGER.error(f"Failed to get job record for {domain}: {e}")
        return None


async def get_job_record_by_task_arn(db: AsyncSession, task_arn: str) -> ReindexingMetadataDb | None:
    """Get job record by task ARN"""
    try:
        result = await db.execute(select(ReindexingMetadataDb).where(ReindexingMetadataDb.task_arn == task_arn))
        return result.scalar_one_or_none()
    except Exception as e:
        LOGGER.error(f"Failed to get job record by taskArn {task_arn}: {e}")
        return None


async def is_job_running(db: AsyncSession, domain: str) -> bool:
    """Check if a job is currently running for a domain"""
    record = await get_job_record_by_domain(db, domain)

    if not record:
        return False

    running_statuses = [
        ReindexingJobStatus.RECEIVED,
        ReindexingJobStatus.UPSERTING,
        ReindexingJobStatus.SYNCING,
        ReindexingJobStatus.OOM_RETRY,
    ]

    return record.status in running_statuses


async def upsert_job_record(
    db: AsyncSession,
    domain: str,
    status: str | None = None,
    memory_mb: int | None = None,
    retry_count: int | None = None,
    task_arn: str | None = None,
    sqs_message_id: str | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    duration_ms: int | None = None,
    num_inserted: int | None = None,
    error: str | None = None,
    reason: str | None = None,
) -> None:
    """Upsert job record in the database"""
    try:
        existing = await get_job_record_by_domain(db, domain)

        if existing:
            update_values: dict[str, object] = {"updated_at": datetime.now(UTC)}

            if status is not None:
                update_values["status"] = status
            if memory_mb is not None:
                update_values["memory_mb"] = memory_mb
            if retry_count is not None:
                update_values["retry_count"] = retry_count
            if task_arn is not None:
                update_values["task_arn"] = task_arn
                if existing.task_arns is None:
                    update_values["task_arns"] = [task_arn]
                elif task_arn not in existing.task_arns:
                    update_values["task_arns"] = [*existing.task_arns, task_arn]
            if sqs_message_id is not None:
                update_values["sqs_message_id"] = sqs_message_id
            if started_at is not None:
                update_values["started_at"] = started_at
            if completed_at is not None:
                update_values["completed_at"] = completed_at
            if duration_ms is not None:
                update_values["duration_ms"] = duration_ms
            if num_inserted is not None:
                update_values["num_inserted"] = num_inserted
            if error is not None:
                update_values["error"] = error
            if reason is not None:
                update_values["reason"] = reason

            await db.execute(
                update(ReindexingMetadataDb).where(ReindexingMetadataDb.domain == domain).values(**update_values)
            )
        else:
            new_record = ReindexingMetadataDb(
                domain=domain,
                status=status or ReindexingJobStatus.RECEIVED,
                memory_mb=memory_mb or 0,
                retry_count=retry_count or 0,
                task_arn=task_arn,
                sqs_message_id=sqs_message_id,
                started_at=started_at or datetime.now(UTC),
                updated_at=datetime.now(UTC),
                completed_at=completed_at,
                duration_ms=duration_ms,
                num_inserted=num_inserted,
                error=error,
                reason=reason,
                task_arns=[task_arn] if task_arn else [],
            )
            db.add(new_record)

        await db.commit()

        LOGGER.info(f"Upserted job record for domain={domain}, status={status}, retry_count={retry_count}")

    except Exception as e:
        await db.rollback()
        LOGGER.error(f"Failed to upsert job record for {domain}: {e}")
        raise


async def update_job_status(
    db: AsyncSession,
    domain: str,
    status: str,
    memory_mb: int | None = None,
    retry_count: int | None = None,
    task_arn: str | None = None,
    sqs_message_id: str | None = None,
    completed_at: datetime | None = None,
    duration_ms: int | None = None,
    num_inserted: int | None = None,
    error: str | None = None,
    reason: str | None = None,
) -> None:
    """Update job status with optional additional fields"""
    try:
        await upsert_job_record(
            db=db,
            domain=domain,
            status=status,
            memory_mb=memory_mb,
            retry_count=retry_count,
            task_arn=task_arn,
            sqs_message_id=sqs_message_id,
            completed_at=completed_at,
            duration_ms=duration_ms,
            num_inserted=num_inserted,
            error=error,
            reason=reason,
        )

        LOGGER.info(f"Updated job status for domain={domain}, status={status}")

    except Exception as e:
        LOGGER.error(f"Failed to update job status for {domain}: {e}")
        raise


async def increment_retry_count(db: AsyncSession, domain: str, new_memory_mb: int, task_arn: str) -> int:
    """Increment retry count for OOM recovery"""
    try:
        existing = await get_job_record_by_domain(db, domain)
        new_retry_count = (existing.retry_count if existing else 0) + 1

        await upsert_job_record(
            db=db,
            domain=domain,
            status=ReindexingJobStatus.OOM_RETRY,
            memory_mb=new_memory_mb,
            retry_count=new_retry_count,
            task_arn=task_arn,
            reason=f"OOM recovery: attempt {new_retry_count}, increased to {new_memory_mb}MB",
        )

        LOGGER.info(
            f"Incremented retry count for domain={domain} to {new_retry_count} with new_memory_mb={new_memory_mb}"
        )

        return new_retry_count

    except Exception as e:
        LOGGER.error(f"Failed to increment retry count for {domain}: {e}")
        raise


async def get_memory_override(db: AsyncSession, domain: str) -> int | None:
    """Get memory override from job record if available"""
    try:
        record = await get_job_record_by_domain(db, domain)

        if record and record.memory_mb and record.memory_mb > 0 and record.reason:
            LOGGER.info(
                f"Found memory override for domain={domain}, memory_mb={record.memory_mb}, reason={record.reason}"
            )
            return record.memory_mb

        return None

    except Exception as e:
        LOGGER.error(f"Failed to get memory override for {domain}: {e}")
        return None
