import uuid
from datetime import (
    UTC,
    datetime,
)

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import (
    and_,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import (
    get_db,
    verify_token,
)
from src.fai.models.api.feedback_api import (
    CreateFeedbackRequest,
    CreateFeedbackResponse,
    GetFeedbackResponse,
)
from src.fai.models.db.feedback_db import FeedbackDb
from src.settings import LOGGER


@fai_app.post(
    "/feedback/{domain}", response_model=CreateFeedbackResponse, openapi_extra={"x-fern-audiences": ["internal"]}
)
async def create_feedback(
    domain: str, request: CreateFeedbackRequest, db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    LOGGER.info(f"Creating feedback for domain {domain}")
    try:
        feedback = FeedbackDb(
            id=str(uuid.uuid4()),
            query_id=request.query_id,
            conversation_id=request.conversation_id,
            domain=domain,
            is_helpful=request.is_helpful,
            feedback_message=request.feedback_message,
            user_email=request.user_email,
            created_at=datetime.now(UTC),
        )
        db.add(feedback)
        await db.commit()
        return JSONResponse(content=jsonable_encoder(CreateFeedbackResponse(feedback_id=feedback.id)))
    except Exception as e:
        LOGGER.exception(f"Failed to create feedback for domain {domain}")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/feedback/{domain}/{conversation_id}",
    response_model=GetFeedbackResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_feedback_by_id(
    domain: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    LOGGER.info(f"Retrieving feedback {conversation_id} for domain {domain}")
    try:
        feedback_stmt = select(FeedbackDb).where(
            and_(FeedbackDb.domain == domain, FeedbackDb.conversation_id == conversation_id)
        )
        feedback_result = await db.execute(feedback_stmt)
        feedback = feedback_result.scalars().first()
        if not feedback:
            return JSONResponse(status_code=404, content={"detail": "Feedback not found"})
        return JSONResponse(content=jsonable_encoder(GetFeedbackResponse(feedback=feedback.to_api())))
    except Exception as e:
        LOGGER.exception(f"Failed to get feedback {conversation_id}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
