from datetime import datetime
from datetime import timedelta
from datetime import timezone
from typing import Optional

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import desc
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.api_models.query import QueryApi
from src.fai.app import fai_app
from src.fai.db_models.query import Query
from src.fai.dependencies import get_db
from src.settings import LOGGER


@fai_app.get("/queries/{domain}")
async def get_recent_queries(
    domain: str,
    cutoff_time: datetime,
    include_assistant: bool = False,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    limit: int = 25,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    LOGGER.info("Listing queries")

    now = datetime.now(timezone.utc)
    end_date = end_date.replace(tzinfo=timezone.utc) if end_date else now
    start_date = start_date.replace(tzinfo=timezone.utc) if start_date else None
    cutoff_time = cutoff_time.replace(tzinfo=timezone.utc)

    effective_end_time = min(end_date, cutoff_time)

    offset = (page - 1) * limit

    stmt = select(Query).where(Query.domain == domain).where(Query.created_at < effective_end_time)

    if not include_assistant:
        stmt = stmt.where(Query.role == "USER")

    if start_date is not None:
        stmt = stmt.where(Query.created_at >= start_date)

    stmt = stmt.order_by(desc(Query.created_at)).offset(offset).limit(limit)

    result = await db.execute(stmt)
    queries = result.scalars().all()
    api_queries = [query.to_api() for query in queries]

    total_stmt = (
        select(func.count(Query.query_id)).where(Query.domain == domain).where(Query.created_at < effective_end_time)
    )

    if not include_assistant:
        total_stmt = total_stmt.where(Query.role == "USER")

    if start_date is not None:
        total_stmt = total_stmt.where(Query.created_at >= start_date)

    total_result = await db.execute(total_stmt)
    total_count = total_result.scalar()

    return JSONResponse(
        content=jsonable_encoder({"queries": [q.model_dump() for q in api_queries], "total": total_count})
    )


@fai_app.post("/queries")
async def create_query(query: QueryApi, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    LOGGER.info("Creating new query")
    try:
        db_query = Query(
            query_id=query.query_id,
            domain=query.domain,
            conversation_id=query.conversation_id,
            text=query.text,
            role=query.role,
            source=query.source,
            created_at=query.created_at,
            time_to_first_token=query.time_to_first_token,
        )
        db.add(db_query)
        await db.commit()
        await db.refresh(db_query)
        LOGGER.info("Query created")
        data = db_query.to_api().model_dump()
        return JSONResponse(content=jsonable_encoder(data))
    except Exception as e:
        LOGGER.exception("Failed to create query")
        return JSONResponse(status_code=500, content={"detail": str(e)})
