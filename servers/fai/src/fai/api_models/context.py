from datetime import datetime
from typing import List

from pydantic import BaseModel


class ContextApi(BaseModel):
    context_id: str
    domain: str
    context: List[str]
    document: str
    document_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
