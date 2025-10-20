from datetime import (
    datetime,
    timedelta,
)

from fastapi import Depends
from fastapi import Query as QueryParam
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    verify_token,
)
from fai.models.api.analytics_api import (
    GetHistogramAnalyticsResponse,
    GetInsightsResponse,
)
from fai.models.db.insight_db import InsightDb
from fai.models.enums.analytics_enums import GroupBy
from fai.scheduler import (
    generate_weekly_insights_job,
    get_scheduler,
)
from fai.settings import LOGGER
from fai.utils.histogram_utils import (
    fetch_grouped_data,
    fill_date_gaps,
)
from fai.utils.insights_job import generate_insights_for_all_domains


@fai_app.get(
    "/analytics/histogram/{domain}",
    response_model=GetHistogramAnalyticsResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
    dependencies=[Depends(get_db), Depends(verify_token)],
)
async def get_analytics_histogram(
    domain: str,
    start_date: datetime | None = QueryParam(
        default=None, description="The start date of the period to retrieve analytics for"
    ),
    end_date: datetime | None = QueryParam(
        default=None, description="The end date of the period to retrieve analytics for"
    ),
    group_by: GroupBy = QueryParam(default=GroupBy.DAY, description="The field to group the analytics by"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    try:
        now = datetime.now()
        start = start_date or (now - timedelta(days=30))
        end = end_date or now

        valid_groups = {"DAY": "day", "WEEK": "week", "MONTH": "month"}
        if group_by not in valid_groups:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid groupBy. Use DAY, WEEK, or MONTH."},
            )

        grouped_data = await fetch_grouped_data(db, domain, start, end, valid_groups[group_by])

        histogram_analytics = fill_date_gaps(start, end, group_by, grouped_data)
        histogram_analytics_response = GetHistogramAnalyticsResponse(bars=histogram_analytics)

        LOGGER.info(f"Retrieved histogram data for domain: {domain}, groupBy: {group_by}")
        return JSONResponse(jsonable_encoder(histogram_analytics_response))

    except Exception as e:
        LOGGER.exception("Failed to get histogram analytics")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/analytics/insights/generate_all",
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def generate_all_insights(
    start_date: datetime | None = QueryParam(
        default=None, description="The start date of the period to generate insights for"
    ),
    end_date: datetime | None = QueryParam(
        default=None, description="The end date of the period to generate insights for"
    ),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Generate insights for all domains with queries in the specified period."""
    try:
        results = await generate_insights_for_all_domains(db, start_date, end_date)
        return JSONResponse(jsonable_encoder(results))
    except Exception as e:
        LOGGER.exception("Failed to generate insights for all domains")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/analytics/insights/trigger_scheduled",
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def trigger_scheduled_insights_generation() -> JSONResponse:
    """Manually trigger the scheduled weekly insights generation job."""
    try:
        scheduler = get_scheduler()

        if not scheduler.running:
            return JSONResponse(status_code=503, content={"detail": "Scheduler is not running"})

        import asyncio

        asyncio.create_task(generate_weekly_insights_job())

        return JSONResponse(
            content={"status": "triggered", "message": "Weekly insights generation job has been triggered"}
        )
    except Exception as e:
        LOGGER.exception("Failed to trigger scheduled insights generation")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/analytics/insights/{domain}",
    response_model=GetInsightsResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
    dependencies=[Depends(get_db), Depends(verify_token)],
)
async def get_query_insights(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Get the most recent insights for a domain."""
    try:
        stmt = select(InsightDb).where(InsightDb.domain == domain).order_by(InsightDb.created_at.desc()).limit(1)
        result = await db.execute(stmt)
        insight_record = result.scalar_one_or_none()

        if insight_record is None:
            empty_response = GetInsightsResponse(insights=[])
            return JSONResponse(jsonable_encoder(empty_response))

        insights_response = insight_record.to_api()
        LOGGER.info(f"Retrieved insights for domain: {domain}")
        return JSONResponse(jsonable_encoder(insights_response))

    except Exception as e:
        LOGGER.exception("Failed to get query insights")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/analytics/scheduler/status",
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_scheduler_status() -> JSONResponse:
    """Get the status of the scheduler and its jobs."""
    try:
        from fai.scheduler import get_scheduler

        scheduler = get_scheduler()

        jobs_info = []
        if scheduler.running:
            for job in scheduler.get_jobs():
                jobs_info.append(
                    {
                        "id": job.id,
                        "name": job.name,
                        "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                        "trigger": str(job.trigger),
                    }
                )

        return JSONResponse(content={"scheduler_running": scheduler.running, "jobs": jobs_info})
    except Exception as e:
        LOGGER.exception("Failed to get scheduler status")
        return JSONResponse(status_code=500, content={"detail": str(e)})