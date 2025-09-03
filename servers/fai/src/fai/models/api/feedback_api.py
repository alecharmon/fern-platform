from pydantic import (
    BaseModel,
    Field,
)

from src.fai.models.types.feedback_types import Feedback


class CreateFeedbackRequest(BaseModel):
    conversation_id: str = Field(description="The ID of the conversation")
    query_id: str = Field(description="The ID of the query")
    domain: str = Field(description="The domain of the conversation")
    is_helpful: bool = Field(description="Whether the conversation was helpful")
    feedback_message: str | None = Field(description="The feedback message from the user")
    user_email: str | None = Field(description="The email of the user")


class CreateFeedbackResponse(BaseModel):
    feedback_id: str = Field(description="The ID of the created feedback")


class GetFeedbackResponse(BaseModel):
    feedback: Feedback = Field(description="The returned feedback")
