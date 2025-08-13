from datetime import datetime
from typing import List

from pydantic import BaseModel


class DocumentApi(BaseModel):
    domain: str
    context: List[str]
    document: str
    document_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
