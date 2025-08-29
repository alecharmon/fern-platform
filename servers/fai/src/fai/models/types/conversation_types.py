from datetime import datetime

from pydantic import BaseModel


class ConversationTurn(BaseModel):
    role: str
    text: str
    created_at: datetime


class Conversation(BaseModel):
    conversation_id: str
    created_at: datetime
    turns: list[ConversationTurn]
