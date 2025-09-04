import hashlib
from datetime import (
    datetime,
    timedelta,
)
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import (
    distinct,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.models.db.insight_db import InsightDb
from src.fai.models.db.query_db import QueryDb
from src.fai.models.types.query_types import Query
from src.fai.utils.insights_utils import get_insights_from_queries
from src.settings import (
    CONFIG,
    LOGGER,
)


def generate_insight_id(domain: str, started_at: datetime) -> str:
    """Generate a unique ID for insights based on domain and start date."""
    date_str = started_at.strftime("%Y-%m-%d")
    id_string = f"{domain}:{date_str}"
    return hashlib.sha256(id_string.encode()).hexdigest()[:16]


async def get_domains_with_recent_queries(db: AsyncSession, start: datetime, end: datetime) -> list[str]:
    """Get all unique domains that have queries in the specified time range."""
    query = (
        select(distinct(QueryDb.domain))
        .where(QueryDb.role == "USER")
        .where(QueryDb.created_at >= start)
        .where(QueryDb.created_at <= end)
    )

    result = await db.execute(query)
    domains = result.scalars().all()
    return list(domains)


async def generate_insights_for_domain(
    db: AsyncSession, domain: str, start: datetime, end: datetime
) -> tuple[str, bool, str]:
    """
    Generate insights for a specific domain and time range.
    Returns: (domain, success, message)
    """
    try:
        insight_id = generate_insight_id(domain, start)

        cached_insight_query = select(InsightDb).where(InsightDb.insight_id == insight_id)
        cached_result = await db.execute(cached_insight_query)
        cached_insight = cached_result.scalar_one_or_none()

        if cached_insight:
            return (domain, True, "Insights already cached")

        query = (
            select(QueryDb)
            .where(QueryDb.domain == domain)
            .where(QueryDb.role == "USER")
            .where(QueryDb.created_at >= start)
            .where(QueryDb.created_at <= end)
        )

        result = await db.execute(query)
        queries = result.scalars().all()

        api_queries: list[Query] = [query.to_api() for query in queries]
        api_queries = [q for q in api_queries if len(q.text.split()) >= 5]

        if len(api_queries) < CONFIG.MIN_INSIGHTS_QUERIES:
            return (domain, False, f"Not enough queries ({len(api_queries)} < {CONFIG.MIN_INSIGHTS_QUERIES})")

        if len(api_queries) > CONFIG.MAX_INSIGHTS_QUERIES:
            api_queries.sort(key=lambda q: q.created_at)
            step = len(api_queries) / CONFIG.MAX_INSIGHTS_QUERIES
            sampled_indices = [int(i * step) for i in range(CONFIG.MAX_INSIGHTS_QUERIES)]
            api_queries = [api_queries[i] for i in sampled_indices]

        insights = await get_insights_from_queries(domain, api_queries)

        new_insight = InsightDb(
            insight_id=insight_id,
            domain=domain,
            started_at=start,
            ended_at=end,
            insights_data=jsonable_encoder(insights),
            created_at=datetime.utcnow(),
        )
        db.add(new_insight)
        await db.commit()

        return (domain, True, f"Generated insights from {len(api_queries)} queries")

    except Exception as e:
        LOGGER.exception(f"Failed to generate insights for domain {domain}")
        await db.rollback()
        return (domain, False, str(e))


async def generate_insights_for_all_domains(
    db: AsyncSession, start: datetime | None = None, end: datetime | None = None
) -> dict[str, Any]:
    if end is None:
        now = datetime.now()
        days_since_sunday = (now.weekday() + 1) % 7
        if days_since_sunday == 0:
            days_since_sunday = 7
        end = (now - timedelta(days=days_since_sunday)).replace(hour=0, minute=0, second=0, microsecond=0)

    if start is None:
        start = end - timedelta(days=7)

    LOGGER.info(f"Generating insights for all domains from {start} to {end}")

    domains = await get_domains_with_recent_queries(db, start, end)

    if not domains:
        LOGGER.info("No domains found with queries in the specified period")
        return {"start_date": start, "end_date": end, "total_domains": 0, "successful": 0, "failed": 0, "results": []}

    LOGGER.info(f"Found {len(domains)} domains with queries")

    results = []
    successful = 0
    failed = 0

    for domain in domains:
        domain_result = await generate_insights_for_domain(db, domain, start, end)
        results.append({"domain": domain_result[0], "success": domain_result[1], "message": domain_result[2]})

        if domain_result[1]:
            successful += 1
        else:
            failed += 1

    LOGGER.info(f"Insights generation complete: {successful} successful, {failed} failed")

    return {
        "start_date": start,
        "end_date": end,
        "total_domains": len(domains),
        "successful": successful,
        "failed": failed,
        "results": results,
    }
