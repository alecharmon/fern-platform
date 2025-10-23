from datetime import (
    UTC,
    datetime,
)

from fastapi import Depends
from fastapi import Query as QueryParam
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import (
    desc,
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    verify_token,
)
from fai.models.api.commons.pagination import PaginationResponse
from fai.models.api.query_api import (
    CreateQueryResponse,
    GetQueriesResponse,
)
from fai.models.db.query_db import QueryDb
from fai.models.types.query_types import Query
from fai.settings import LOGGER


@fai_app.post(
    "/queries",
    response_model=CreateQueryResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def create_query(
    domain: str, query: Query, db: AsyncSession = Depends(get_db), _: None = Depends(verify_token)
) -> JSONResponse:
    LOGGER.info("Creating new query")
    try:
        db_query = QueryDb(
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
        return JSONResponse(content=jsonable_encoder(CreateQueryResponse(query_id=db_query.query_id)))
    except Exception as e:
        LOGGER.exception("Failed to create query")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/queries/{domain}",
    response_model=GetQueriesResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def get_recent_queries(
    domain: str,
    db: AsyncSession = Depends(get_db),
    page: int | None = QueryParam(default=None, description="The page number for pagination"),
    limit: int | None = QueryParam(default=None, description="The number of queries per page"),
    cutoff_time: datetime | None = QueryParam(default=None, description="Only return queries after this time"),
    include_assistant: bool | None = QueryParam(
        default=None, description="Whether to include assistant responses in the results"
    ),
    start_date: datetime | None = QueryParam(
        default=None, description="The start date of the period to retrieve analytics for"
    ),
    end_date: datetime | None = QueryParam(
        default=None, description="The end date of the period to retrieve analytics for"
    ),
    _: None = Depends(verify_token),
) -> JSONResponse:
    LOGGER.info("Listing queries")

    now = datetime.now(UTC)
    end_date_tz = end_date.replace(tzinfo=UTC) if end_date else now
    start_date_tz = start_date.replace(tzinfo=UTC) if start_date else None
    cutoff_time_tz = cutoff_time.replace(tzinfo=UTC) if cutoff_time else now

    effective_end_time = min(end_date_tz, cutoff_time_tz)

    page_num = page or 1
    limit_num = limit or 25
    offset = (page_num - 1) * limit_num

    stmt = select(QueryDb).where(QueryDb.domain == domain).where(QueryDb.created_at < effective_end_time)

    if not include_assistant:
        stmt = stmt.where(QueryDb.role == "USER")

    if start_date_tz is not None:
        stmt = stmt.where(QueryDb.created_at >= start_date_tz)

    stmt = stmt.order_by(desc(QueryDb.created_at)).offset(offset).limit(limit_num)

    result = await db.execute(stmt)
    queries = result.scalars().all()
    api_queries = [query.to_api() for query in queries]

    total_stmt = (
        select(func.count(QueryDb.query_id))
        .where(QueryDb.domain == domain)
        .where(QueryDb.created_at < effective_end_time)
    )

    if not include_assistant:
        total_stmt = total_stmt.where(QueryDb.role == "USER")

    if start_date_tz is not None:
        total_stmt = total_stmt.where(QueryDb.created_at >= start_date_tz)

    total_result = await db.execute(total_stmt)
    total_count = total_result.scalar()

    return JSONResponse(
        content=jsonable_encoder(
            GetQueriesResponse(
                queries=api_queries,
                pagination=PaginationResponse(total=total_count, page=page_num, limit=limit_num),
            )
        )
    )
