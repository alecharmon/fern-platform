from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import and_
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.db_models.query import Query
from src.fai.dependencies import get_db
from src.settings import LOGGER


@fai_app.get("/conversations/{domain}/{conversation_id}")
async def get_conversation(
    domain: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    LOGGER.info(f"Retrieving conversation {conversation_id} for domain {domain}")
    try:
        queries_stmt = (
            select(Query)
            .where(and_(Query.domain == domain, Query.conversation_id == conversation_id))
            .order_by(Query.created_at)
        )
        queries_result = await db.execute(queries_stmt)
        queries = queries_result.scalars().all()

        if not queries:
            return JSONResponse(status_code=404, content={"detail": "Conversation not found"})

        turns = []
        for query in queries:
            turn_data = {
                "role": query.role,
                "text": query.text,
                "created_at": query.created_at.isoformat(),
            }
            turns.append(turn_data)

        conversation = {
            "conversation_id": conversation_id,
            "created_at": turns[-1]["created_at"] if turns else None,
            "turns": turns,
        }

        return JSONResponse(content=jsonable_encoder(conversation))
    except Exception as e:
        LOGGER.exception(f"Failed to get conversation {conversation_id}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
