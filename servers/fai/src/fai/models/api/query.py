from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class QueryApi(BaseModel):
    query_id: str
    conversation_id: str
    domain: str
    text: str
    role: str
    source: str
    created_at: datetime
    time_to_first_token: Optional[float] = None
