from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import (
    and_,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.models.api.conversation_api import GetConversationResponse
from src.fai.models.db.query_db import QueryDb
from src.fai.models.types.conversation_types import (
    Conversation,
    ConversationTurn,
)
from src.settings import LOGGER


@fai_app.get("/conversation/{domain}/{conversation_id}", response_model=GetConversationResponse)
async def get_conversation(
    domain: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    LOGGER.info(f"Retrieving conversation {conversation_id} for domain {domain}")
    try:
        queries_stmt = (
            select(QueryDb)
            .where(and_(QueryDb.domain == domain, QueryDb.conversation_id == conversation_id))
            .order_by(QueryDb.created_at)
        )
        queries_result = await db.execute(queries_stmt)
        queries = queries_result.scalars().all()

        if not queries:
            return JSONResponse(status_code=404, content={"detail": "Conversation not found"})

        turns = []
        for query in queries:
            turns.append(ConversationTurn(role=query.role, text=query.text, created_at=query.created_at.isoformat()))

        conversation = Conversation(
            conversation_id=conversation_id,
            created_at=turns[-1].created_at if turns else None,
            turns=turns,
        )
        conversation_response = GetConversationResponse(conversation=conversation)
        return JSONResponse(content=jsonable_encoder(conversation_response))
    except Exception as e:
        LOGGER.exception(f"Failed to get conversation {conversation_id}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
