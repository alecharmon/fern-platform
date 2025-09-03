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
from src.fai.models.db.feedback_db import FeedbackDb
from src.fai.models.db.query_db import QueryDb
from src.fai.models.types.conversation_types import (
    Conversation,
    ConversationTurn,
    ConversationTurnFeedback,
)
from src.settings import LOGGER


@fai_app.get("/conversation/{domain}/{conversation_id}", response_model=GetConversationResponse)
async def get_conversation_by_id(
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

        feedback_stmt = select(FeedbackDb).where(
            and_(FeedbackDb.domain == domain, FeedbackDb.conversation_id == conversation_id)
        )
        feedback_result = await db.execute(feedback_stmt)
        feedbacks = feedback_result.scalars().all()

        feedback_by_query: dict[str, list[FeedbackDb]] = {}
        for feedback in feedbacks:
            if feedback.query_id not in feedback_by_query:
                feedback_by_query[feedback.query_id] = []
            feedback_by_query[feedback.query_id].append(feedback)

        turns: list[ConversationTurn] = []
        for query in queries:
            turn_feedback = None
            if query.query_id in feedback_by_query:
                latest_feedback = max(feedback_by_query[query.query_id], key=lambda f: f.created_at)
                turn_feedback = ConversationTurnFeedback(
                    is_helpful=latest_feedback.is_helpful, feedback_message=latest_feedback.feedback_message
                )

            turns.append(
                ConversationTurn(
                    role=query.role, text=query.text, created_at=query.created_at.isoformat(), feedback=turn_feedback
                )
            )

        conversation = Conversation(
            conversation_id=conversation_id,
            created_at=turns[-1].created_at if turns else None,
            turns=turns,
        )
        return JSONResponse(content=jsonable_encoder(GetConversationResponse(conversation=conversation)))
    except Exception as e:
        LOGGER.exception(f"Failed to get conversation {conversation_id}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
