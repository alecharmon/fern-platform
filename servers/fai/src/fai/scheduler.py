from typing import Any

from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from fai.db import async_session_maker
from fai.jobs.cleanup_job import cleanup_preview_settings
from fai.jobs.conversation_reports_job import process_conversation_reports
from fai.jobs.insights_job import generate_insights_for_all_domains
from fai.jobs.scribe_pr_status_job import check_scribe_pr_statuses
from fai.settings import LOGGER

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler

    if _scheduler is None:
        jobstores = {"default": MemoryJobStore()}

        executors = {"default": AsyncIOExecutor()}

        job_defaults = {
            "coalesce": True,  # Coalesce missed jobs into one
            "max_instances": 1,  # Only one instance of each job at a time
            "misfire_grace_time": 3600,  # 1 hour grace time for misfired jobs
        }

        _scheduler = AsyncIOScheduler(
            jobstores=jobstores, executors=executors, job_defaults=job_defaults, timezone="UTC"
        )

    return _scheduler


async def generate_weekly_insights_job() -> None:
    LOGGER.info("Starting scheduled weekly insights generation")

    try:
        async with async_session_maker() as db:
            results = await generate_insights_for_all_domains(db)

            LOGGER.info(
                f"Scheduled insights generation completed: "
                f"{results['successful']} successful, {results['failed']} failed "
                f"out of {results['total_domains']} domains"
            )

            for result in results["results"]:
                if not result["success"]:
                    LOGGER.warning(f"Failed to generate insights for {result['domain']}: {result['message']}")

    except Exception as e:
        LOGGER.exception(f"Error in scheduled insights generation: {e}")


async def cleanup_preview_settings_job() -> None:
    LOGGER.info("Starting scheduled preview settings cleanup")

    try:
        async with async_session_maker() as db:
            results = await cleanup_preview_settings(db)

            LOGGER.info(
                f"Scheduled preview settings cleanup completed: " f"{results['deleted_count']} preview settings deleted"
            )

            if results["deleted_domains"]:
                LOGGER.info(f"Deleted domains: {', '.join(results['deleted_domains'])}")

    except Exception as e:
        LOGGER.exception(f"Error in scheduled preview settings cleanup: {e}")


async def process_conversation_reports_job() -> None:
    LOGGER.info("Starting scheduled conversation reports processing")

    try:
        async with async_session_maker() as db:
            results = await process_conversation_reports(db)

            LOGGER.info(
                f"Scheduled conversation reports processing completed: "
                f"{results['successful']} successful, {results['failed']} failed "
                f"out of {results['total_conversations']} conversations"
            )

            for result in results["results"]:
                if not result["success"]:
                    LOGGER.warning(
                        f"Failed to process report for conversation {result['conversation_id']}: {result['message']}"
                    )

    except Exception as e:
        LOGGER.exception(f"Error in scheduled conversation reports processing: {e}")


async def check_scribe_pr_statuses_job() -> None:
    LOGGER.info("Starting scheduled Scribe PR status check")

    try:
        async with async_session_maker() as db:
            results = await check_scribe_pr_statuses(db)

            LOGGER.info(
                f"Scheduled Scribe PR status check completed: "
                f"{results['checked']} checked, {results['merged']} merged, {results['errors']} errors"
            )

    except Exception as e:
        LOGGER.exception(f"Error in scheduled Scribe PR status check: {e}")


def configure_jobs(scheduler: AsyncIOScheduler) -> None:
    scheduler.add_job(
        func=generate_weekly_insights_job,
        trigger=CronTrigger(day_of_week="sun", hour=2, minute=0, timezone="UTC"),
        id="weekly_insights_generation",
        name="Generate weekly insights for all domains",
        replace_existing=True,
    )

    scheduler.add_job(
        func=cleanup_preview_settings_job,
        trigger=CronTrigger(day_of_week="mon,wed,fri", hour=2, minute=0, timezone="UTC"),
        id="preview_settings_cleanup",
        name="Clean up preview settings older than 1 day",
        replace_existing=True,
    )

    scheduler.add_job(
        func=process_conversation_reports_job,
        trigger=CronTrigger(minute=0, timezone="UTC"),
        id="conversation_reports_processing",
        name="Process conversation reports hourly",
        replace_existing=True,
    )

    scheduler.add_job(
        func=check_scribe_pr_statuses_job,
        trigger=CronTrigger(minute="*/30", timezone="UTC"),
        id="scribe_pr_status_check",
        name="Check Scribe PR statuses every 30 minutes",
        replace_existing=True,
    )

    LOGGER.info("Scheduled jobs configured")


def start_scheduler() -> AsyncIOScheduler:
    scheduler = get_scheduler()

    if not scheduler.running:
        configure_jobs(scheduler)
        scheduler.start()
        LOGGER.info("Scheduler started successfully")

        for job in scheduler.get_jobs():
            LOGGER.info(f"  Job: {job.name} (ID: {job.id}) - Next run: {job.next_run_time}")
    else:
        LOGGER.info("Scheduler is already running")

    return scheduler


def stop_scheduler() -> None:
    global _scheduler

    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=True)
        LOGGER.info("Scheduler stopped successfully")
        _scheduler = None
    else:
        LOGGER.info("Scheduler is not running")


async def run_job_immediately(job_id: str) -> dict[str, Any]:
    scheduler = get_scheduler()

    if not scheduler.running:
        raise RuntimeError("Scheduler is not running")

    job = scheduler.get_job(job_id)
    if not job:
        raise ValueError(f"Job with ID '{job_id}' not found")

    LOGGER.info(f"Manually triggering job: {job.name}")

    job.modify(next_run_time=None)
    scheduler.modify_job(job_id, next_run_time="now")

    return {"status": "triggered", "job_id": job_id, "job_name": job.name}
