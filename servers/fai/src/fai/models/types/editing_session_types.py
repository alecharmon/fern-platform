from datetime import datetime

from pydantic import BaseModel


class EditingSession(BaseModel):
    id: str
    session_id: str | None
    repository: str
    base_branch: str
    working_branch: str
    pr_url: str | None
    created_at: datetime
    updated_at: datetime
