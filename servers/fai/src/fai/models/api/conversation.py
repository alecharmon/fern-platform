from datetime import datetime

from pydantic import BaseModel


class ConversationTurnApi(BaseModel):
    role: str
    text: str
    created_at: datetime


class ConversationApi(BaseModel):
    conversation_id: str
    created_at: datetime
    turns: list[ConversationTurnApi]
