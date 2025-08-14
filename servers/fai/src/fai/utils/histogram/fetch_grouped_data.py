from datetime import datetime

from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.api_models.analytics import HistogramAnalyticsApi
from src.fai.api_models.analytics import HistogramAnalyticsBarApi
from src.fai.db_models.query import Query


async def fetch_grouped_data(
    db: AsyncSession,
    domain: str,
    start: datetime,
    end: datetime,
    trunc_format: str,
) -> HistogramAnalyticsApi:
    """
    Queries the database and returns a dictionary with truncated date labels as keys
    and conversation/query counts as values.
    """
    date_label = func.date_trunc(trunc_format, Query.created_at).label("label")
    conversation_count = func.count(func.distinct(Query.conversation_id)).label("conversationCount")
    query_count = func.count(Query.query_id).label("queryCount")

    stmt = (
        select(date_label, conversation_count, query_count)
        .where(and_(Query.domain == domain, Query.created_at >= start, Query.created_at <= end))
        .where(Query.role == "USER")
        .group_by(date_label)
        .order_by(date_label)
    )

    result = await db.execute(stmt)
    rows = result.fetchall()

    return HistogramAnalyticsApi(
        bars=[
            HistogramAnalyticsBarApi(
                label=row.label.strftime("%Y-%m-%d"),
                conversationCount=row.conversationCount,
                queryCount=row.queryCount,
            )
            for row in rows
        ]
    )
