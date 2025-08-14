from typing import List
from typing import Optional

from pydantic import BaseModel


class IndexGuidanceRequest(BaseModel):
    index_name: Optional[str] = None
    context: List[str]
    document: str


class UpdateGuidanceRequest(BaseModel):
    context: Optional[List[str]] = None
    document: Optional[str] = None
