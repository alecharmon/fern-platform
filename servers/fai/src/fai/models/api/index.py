from typing import List
from typing import Optional

from pydantic import BaseModel


class IndexRequest(BaseModel):
    index_name: Optional[str] = None
    document_id: str
    context: List[str]
    document: str


class UpdateIndexRequest(BaseModel):
    context: Optional[List[str]] = None
    document: Optional[str] = None
    is_active: Optional[bool] = None
