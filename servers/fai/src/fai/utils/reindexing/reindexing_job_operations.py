import uuid
from datetime import (
    UTC,
    datetime,
    timedelta,
)

import sentry_sdk
from sqlalchemy import (
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.reindexing_job_db import ReindexingJobDb
from fai.models.db.settings_db import SettingsDb
from fai.models.enums.reindexing_enums import ReindexingJobStatus
from fai.settings import LOGGER

STALE_JOB_THRESHOLD_MINUTES = 30


def _normalize_basepath(basepath: str | None) -> str:
    """Normalize basepath: None becomes empty string, strip trailing slashes."""
    if not basepath:
        return ""
    return basepath.rstrip("/") or ""


async def create_job(
    db: AsyncSession,
    domain: str,
    basepath: str | None = None,
    force_full_reindex: bool = False,
) -> ReindexingJobDb:
    """Create a new reindexing job with status=queued."""
    job_id = str(uuid.uuid4())
    now = datetime.now(UTC)
    basepath = _normalize_basepath(basepath)

    new_job = ReindexingJobDb(
        id=job_id,
        domain=domain,
        basepath=basepath,
        force_full_reindex=force_full_reindex,
        status=ReindexingJobStatus.QUEUED,
        retry_count=0,
        created_at=now,
        updated_at=now,
    )
    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)

    LOGGER.info(f"Created reindexing job {job_id} for domain={domain}, basepath={basepath}")
    return new_job


async def set_sqs_message_id(
    db: AsyncSession,
    job_id: str,
    sqs_message_id: str,
) -> None:
    """Set the SQS message ID on a job after sending the SQS message."""
    await db.execute(
        update(ReindexingJobDb)
        .where(ReindexingJobDb.id == job_id)
        .values(sqs_message_id=sqs_message_id, updated_at=datetime.now(UTC))
    )
    await db.commit()
    LOGGER.info(f"Set sqs_message_id={sqs_message_id} on job {job_id}")


async def get_job_by_id(db: AsyncSession, job_id: str) -> ReindexingJobDb | None:
    """Get a job by its ID."""
    try:
        result = await db.execute(select(ReindexingJobDb).where(ReindexingJobDb.id == job_id))
        return result.scalar_one_or_none()
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to get job {job_id}: {e}")
        return None


async def get_latest_job_for_domain(db: AsyncSession, domain: str) -> ReindexingJobDb | None:
    """Get the most recent job for a domain."""
    try:
        result = await db.execute(
            select(ReindexingJobDb)
            .where(ReindexingJobDb.domain == domain)
            .order_by(ReindexingJobDb.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to get latest job for domain {domain}: {e}")
        return None


async def get_running_job_for_domain(
    db: AsyncSession, domain: str, basepath: str | None = None
) -> ReindexingJobDb | None:
    """Get the currently running job for a domain+basepath (if any)."""
    basepath = _normalize_basepath(basepath)
    running_statuses = [
        ReindexingJobStatus.QUEUED,
        ReindexingJobStatus.RECEIVED,
        ReindexingJobStatus.UPSERTING,
        ReindexingJobStatus.SYNCING,
        ReindexingJobStatus.OOM_RETRY,
    ]
    try:
        conditions = [
            ReindexingJobDb.domain == domain,
            ReindexingJobDb.status.in_(running_statuses),
            ReindexingJobDb.basepath == basepath,
        ]

        result = await db.execute(
            select(ReindexingJobDb)
            .where(*conditions)
            .order_by(ReindexingJobDb.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to get running job for domain {domain} basepath={basepath}: {e}")
        return None


async def get_job_by_task_arn(db: AsyncSession, task_arn: str) -> ReindexingJobDb | None:
    """Get a job by searching the task_arns array."""
    try:
        result = await db.execute(
            select(ReindexingJobDb)
            .where(ReindexingJobDb.task_arns.any(task_arn))
            .order_by(ReindexingJobDb.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to get job by task_arn {task_arn}: {e}")
        return None


async def update_job_status(
    db: AsyncSession,
    job_id: str,
    status: ReindexingJobStatus | str,
    memory_mb: int | None = None,
    retry_count: int | None = None,
    task_arn: str | None = None,
    sqs_message_id: str | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    num_inserted: int | None = None,
    error: str | None = None,
    reason: str | None = None,
) -> None:
    """Update a job's status and optional fields."""
    try:
        now = datetime.now(UTC)
        update_values: dict[str, object] = {
            "status": status,
            "updated_at": now,
        }

        optional_fields: dict[str, object | None] = {
            "memory_mb": memory_mb,
            "retry_count": retry_count,
            "sqs_message_id": sqs_message_id,
            "started_at": started_at,
            "completed_at": completed_at,
            "num_inserted": num_inserted,
            "error": error,
            "reason": reason,
        }
        update_values.update({k: v for k, v in optional_fields.items() if v is not None})

        # Append task_arn to the task_arns array
        if task_arn is not None:
            job = await get_job_by_id(db, job_id)
            if job:
                existing_arns = job.task_arns or []
                if task_arn not in existing_arns:
                    update_values["task_arns"] = [*existing_arns, task_arn]

        # Calculate job_total_time_ms when job completes or fails
        if status in (ReindexingJobStatus.COMPLETED, ReindexingJobStatus.FAILED):
            job = await get_job_by_id(db, job_id)
            if job and job.created_at:
                total_time = now - job.created_at
                update_values["job_total_time_ms"] = int(total_time.total_seconds() * 1000)
            if completed_at is None:
                update_values["completed_at"] = now

        await db.execute(
            update(ReindexingJobDb).where(ReindexingJobDb.id == job_id).values(**update_values)
        )

        # Keep settings.last_reindex_time in sync for backwards compatibility
        if status == ReindexingJobStatus.COMPLETED:
            completed_job = await get_job_by_id(db, job_id)
            if completed_job:
                try:
                    result = await db.execute(
                        select(SettingsDb).where(
                            SettingsDb.domain == completed_job.domain,
                            SettingsDb.basepath == (completed_job.basepath or ""),
                        )
                    )
                    settings_record = result.scalar_one_or_none()
                    if settings_record:
                        settings_record.last_reindex_time = now
                except Exception as settings_err:
                    sentry_sdk.capture_exception(settings_err)
                    LOGGER.warning(f"Failed to update settings.last_reindex_time for job {job_id}: {settings_err}")

        await db.commit()

        LOGGER.info(f"Updated job {job_id} status={status}")

    except Exception as e:
        await db.rollback()
        LOGGER.error(f"Failed to update job {job_id}: {e}")
        raise


async def has_completed_reindex(
    db: AsyncSession, domain: str, basepath: str | None = None
) -> bool:
    """Check if there is at least one completed reindexing job for a domain+basepath."""
    basepath = _normalize_basepath(basepath)
    try:
        result = await db.execute(
            select(ReindexingJobDb.id)
            .where(
                ReindexingJobDb.domain == domain,
                ReindexingJobDb.basepath == basepath,
                ReindexingJobDb.status == ReindexingJobStatus.COMPLETED,
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to check completed reindex for domain {domain} basepath={basepath}: {e}")
        return False


async def get_last_completed_reindex_time(
    db: AsyncSession, domain: str, basepath: str | None = None
) -> datetime | None:
    """Get the completed_at timestamp of the most recent completed job for a domain+basepath."""
    basepath = _normalize_basepath(basepath)
    try:
        result = await db.execute(
            select(ReindexingJobDb.completed_at)
            .where(
                ReindexingJobDb.domain == domain,
                ReindexingJobDb.basepath == basepath,
                ReindexingJobDb.status == ReindexingJobStatus.COMPLETED,
            )
            .order_by(ReindexingJobDb.completed_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to get last completed reindex time for domain {domain} basepath={basepath}: {e}")
        return None


async def find_stale_running_jobs(
    db: AsyncSession, domain: str, basepath: str | None = None
) -> list[ReindexingJobDb]:
    """Find running jobs for a domain+basepath that haven't been updated in STALE_JOB_THRESHOLD_MINUTES."""
    basepath = _normalize_basepath(basepath)
    running_statuses = [
        ReindexingJobStatus.QUEUED,
        ReindexingJobStatus.RECEIVED,
        ReindexingJobStatus.UPSERTING,
        ReindexingJobStatus.SYNCING,
        ReindexingJobStatus.OOM_RETRY,
    ]
    threshold = datetime.now(UTC) - timedelta(minutes=STALE_JOB_THRESHOLD_MINUTES)

    try:
        conditions = [
            ReindexingJobDb.domain == domain,
            ReindexingJobDb.status.in_(running_statuses),
            ReindexingJobDb.updated_at < threshold,
            ReindexingJobDb.basepath == basepath,
        ]

        result = await db.execute(
            select(ReindexingJobDb).where(*conditions)
        )
        return list(result.scalars().all())
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to find stale jobs for domain {domain} basepath={basepath}: {e}")
        return []


async def mark_stale_jobs_failed(db: AsyncSession, domain: str, basepath: str | None = None) -> int:
    """Find and mark stale running jobs as failed. Returns count of jobs marked."""
    stale_jobs = await find_stale_running_jobs(db, domain, basepath)
    count = 0

    for job in stale_jobs:
        try:
            await update_job_status(
                db=db,
                job_id=job.id,
                status=ReindexingJobStatus.FAILED,
                error=f"Timed out — no update in {STALE_JOB_THRESHOLD_MINUTES} minutes",
            )
            count += 1
            LOGGER.info(f"Marked stale job {job.id} as failed for domain={domain}")
        except Exception as e:
            sentry_sdk.capture_exception(e)
            LOGGER.error(f"Failed to mark stale job {job.id} as failed: {e}")

    return count
