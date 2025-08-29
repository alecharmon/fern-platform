from datetime import datetime

from pydantic import BaseModel


class Guidance(BaseModel):
    domain: str
    context: list[str]
    document: str
    guidance_id: str
    created_at: datetime
    updated_at: datetime
