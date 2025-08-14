from datetime import datetime
from typing import List
from typing import Optional

from pydantic import BaseModel


class GuidanceApi(BaseModel):
    domain: str
    context: List[str]
    document: str
    guidance_id: str
    created_at: datetime
    updated_at: datetime


class IndexGuidanceRequest(BaseModel):
    context: List[str]
    document: str


class UpdateGuidanceRequest(BaseModel):
    context: Optional[List[str]] = None
    document: Optional[str] = None
