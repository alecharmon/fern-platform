from datetime import datetime

from pydantic import BaseModel


class ConversationTurnFeedback(BaseModel):
    is_helpful: bool
    feedback_message: str | None = None


class ConversationTurn(BaseModel):
    role: str
    text: str
    created_at: datetime
    feedback: ConversationTurnFeedback | None = None


class Conversation(BaseModel):
    conversation_id: str
    created_at: datetime
    turns: list[ConversationTurn]
