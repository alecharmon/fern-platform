from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class EditingSessionStatus(str, Enum):
    """Status of an editing session."""

    STARTUP = "startup"
    WAITING = "waiting"
    ACTIVE = "active"
    INTERRUPTED = "interrupted"
    COMPLETED = "completed"


class EditingSession(BaseModel):
    id: str
    session_id: str | None
    repository: str
    base_branch: str
    working_branch: str
    pr_url: str | None
    status: EditingSessionStatus
    created_at: datetime
    updated_at: datetime
