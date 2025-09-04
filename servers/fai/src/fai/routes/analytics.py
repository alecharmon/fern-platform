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
from src.settings import LOGGER


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

        if start_date is not None:
            start = start_date
            query = query.where(QueryDb.created_at >= start)

        if end_date is not None:
            end = end_date
            query = query.where(QueryDb.created_at <= end)

        result = await db.execute(query)
        queries = result.scalars().all()

        api_queries: list[Query] = [query.to_api() for query in queries]
        insights = await get_insights_from_queries(domain, api_queries)

        return JSONResponse(jsonable_encoder(insights))

    except Exception as e:
        LOGGER.exception("Failed to get insights analytics")
        return JSONResponse(status_code=500, content={"detail": str(e)})
