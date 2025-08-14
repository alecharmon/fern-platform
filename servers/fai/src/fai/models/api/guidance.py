from datetime import datetime
from typing import List

from pydantic import BaseModel


class GuidanceApi(BaseModel):
    domain: str
    context: List[str]
    document: str
    guidance_id: str
    created_at: datetime
    updated_at: datetime
