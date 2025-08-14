from datetime import datetime
from datetime import timedelta
from typing import List

from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.models.api.analytics import HistogramAnalyticsApi
from src.fai.models.api.analytics import HistogramAnalyticsBarApi
from src.fai.models.db.query import Query


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


def fill_date_gaps(
    start: datetime,
    end: datetime,
    groupBy: str,
    counts: HistogramAnalyticsApi,
) -> HistogramAnalyticsApi:
    """
    Returns a list of dicts with label, conversationCount, and queryCount,
    filling in missing time intervals with zeroes.
    """
    data: List[HistogramAnalyticsBarApi] = []

    if groupBy == "DAY":
        step = timedelta(days=1)
        current = start
    elif groupBy == "WEEK":
        current = (start - timedelta(days=start.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        step = timedelta(weeks=1)
    elif groupBy == "MONTH":
        current = start.replace(day=1)

    while current <= end:
        label = current.strftime("%Y-%m-%d")
        count = next(
            (bar for bar in counts.bars if bar.label == label),
            HistogramAnalyticsBarApi(label=label, conversationCount=0, queryCount=0),
        )
        if current >= start and current <= end:
            data.append(
                HistogramAnalyticsBarApi(
                    label=label,
                    conversationCount=count.conversationCount,
                    queryCount=count.queryCount,
                )
            )

        if groupBy == "MONTH":
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1, day=1)
            else:
                current = current.replace(month=current.month + 1, day=1)
        else:
            current += step

    return HistogramAnalyticsApi(bars=data)
