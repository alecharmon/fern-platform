from datetime import datetime

from pydantic import BaseModel


class Settings(BaseModel):
    domain: str
    org_name: str
    last_reindex_time: datetime | None = None
    job_id: str | None = None
