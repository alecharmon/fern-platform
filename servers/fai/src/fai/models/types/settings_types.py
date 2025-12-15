from datetime import datetime

from pydantic import BaseModel


class Settings(BaseModel):
    domain: str
    org_name: str
    last_reindex_time: datetime | None = None
    job_id: str | None = None
    docs_enabled: bool = True
    slack_enabled: bool = True
    discord_enabled: bool = True
    decompose_queries: bool = False
