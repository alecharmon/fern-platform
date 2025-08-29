from datetime import (
    datetime,
    timedelta,
)

from sqlalchemy import (
    and_,
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.models.db.query_db import QueryDb
from src.fai.models.types.analytics_types import HistogramAnalyticsBar


async def fetch_grouped_data(
    db: AsyncSession,
    domain: str,
    start: datetime,
    end: datetime,
    trunc_format: str,
) -> list[HistogramAnalyticsBar]:
    """
    Queries the database and returns a dictionary with truncated date labels as keys
    and conversation/query counts as values.
    """
    date_label = func.date_trunc(trunc_format, QueryDb.created_at).label("label")
    conversation_count = func.count(func.distinct(QueryDb.conversation_id)).label("conversationCount")
    query_count = func.count(QueryDb.query_id).label("queryCount")

    stmt = (
        select(date_label, conversation_count, query_count)
        .where(and_(QueryDb.domain == domain, QueryDb.created_at >= start, QueryDb.created_at <= end))
        .where(QueryDb.role == "USER")
        .group_by(date_label)
        .order_by(date_label)
    )

    result = await db.execute(stmt)
    rows = result.fetchall()

    return [
        HistogramAnalyticsBar(
            label=row.label.strftime("%Y-%m-%d"),
            conversationCount=row.conversationCount,
            queryCount=row.queryCount,
        )
        for row in rows
    ]


def fill_date_gaps(
    start: datetime,
    end: datetime,
    groupBy: str,
    counts: list[HistogramAnalyticsBar],
) -> list[HistogramAnalyticsBar]:
    """
    Returns a list of dicts with label, conversationCount, and queryCount,
    filling in missing time intervals with zeroes.
    """
    data: list[HistogramAnalyticsBar] = []

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
            (bar for bar in counts if bar.label == label),
            HistogramAnalyticsBar(label=label, conversationCount=0, queryCount=0),
        )
        if current >= start and current <= end:
            data.append(
                HistogramAnalyticsBar(
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

    return data
