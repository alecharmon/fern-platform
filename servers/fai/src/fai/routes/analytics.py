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

from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.models.api.analytics_api import (
    GetHistogramAnalyticsResponse,
    GetInsightsResponse,
)
from src.fai.models.db.query_db import QueryDb
from src.fai.models.enums.analytics_enums import GroupBy
from src.fai.models.types.query_types import Query
from src.fai.utils.histogram_utils import (
    fetch_grouped_data,
    fill_date_gaps,
)
from src.fai.utils.insights_utils import get_insights_from_queries
from src.settings import (
    CONFIG,
    LOGGER,
)


@fai_app.get(
    "/analytics/histogram/{domain}",
    response_model=GetHistogramAnalyticsResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
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


@fai_app.get(
    "/analytics/insights/{domain}", response_model=GetInsightsResponse, openapi_extra={"x-fern-audiences": ["internal"]}
)
async def get_analytics_insights(
    domain: str,
    start_date: datetime | None = QueryParam(
        default=None, description="The start date of the period to retrieve analytics for"
    ),
    end_date: datetime | None = QueryParam(
        default=None, description="The end date of the period to retrieve analytics for"
    ),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        query = select(QueryDb).where(QueryDb.domain == domain).where(QueryDb.role == "USER")

        if end_date is None:
            now = datetime.now()
            days_since_sunday = (now.weekday() + 1) % 7
            if days_since_sunday == 0:
                days_since_sunday = 7
            end = (now - timedelta(days=days_since_sunday)).replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            end = end_date

        if start_date is None:
            start = end - timedelta(days=7)
        else:
            start = start_date

        query = query.where(QueryDb.created_at >= start).where(QueryDb.created_at <= end)

        result = await db.execute(query)
        queries = result.scalars().all()

        api_queries: list[Query] = [query.to_api() for query in queries]
        api_queries = [q for q in api_queries if len(q.text.split()) >= 5]

        if len(api_queries) < CONFIG.MIN_INSIGHTS_QUERIES:
            return JSONResponse(status_code=400, content={"detail": "Not enough queries to generate insights"})

        if len(api_queries) > CONFIG.MAX_INSIGHTS_QUERIES:
            api_queries.sort(key=lambda q: q.created_at)
            step = len(api_queries) / CONFIG.MAX_INSIGHTS_QUERIES
            sampled_indices = [int(i * step) for i in range(CONFIG.MAX_INSIGHTS_QUERIES)]
            api_queries = [api_queries[i] for i in sampled_indices]

        insights = await get_insights_from_queries(domain, api_queries)

        return JSONResponse(jsonable_encoder(insights))

    except Exception as e:
        LOGGER.exception("Failed to get insights analytics")
        return JSONResponse(status_code=500, content={"detail": str(e)})
