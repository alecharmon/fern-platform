from datetime import datetime

from pydantic import BaseModel


class Feedback(BaseModel):
    query_id: str
    conversation_id: str
    domain: str
    is_helpful: bool
    feedback_message: str | None = None
    user_email: str | None = None
    created_at: datetime
