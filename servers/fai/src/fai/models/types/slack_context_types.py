from datetime import datetime

from pydantic import BaseModel


class SlackContext(BaseModel):
    slack_context_id: str
    domain: str
    question: str
    ideal_response: str
    created_at: datetime
    updated_at: datetime
