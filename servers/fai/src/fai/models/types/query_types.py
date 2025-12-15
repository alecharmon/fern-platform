from datetime import datetime

from pydantic import BaseModel


class Query(BaseModel):
    query_id: str
    conversation_id: str
    domain: str
    text: str
    role: str
    source: str
    created_at: datetime
    time_to_first_token: float | None = None
    subqueries: list[str] | None = None
