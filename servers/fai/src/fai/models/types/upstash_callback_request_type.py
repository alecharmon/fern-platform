from pydantic import BaseModel


class UpstashCallbackRequest(BaseModel):
    """Callback payload from Upstash QStash when a queued job completes."""

    status: int
    sourceMessageId: str
    url: str | None = None
    method: str | None = None
    sourceHeader: dict[str, str] | None = None
    sourceBody: str | None = None
    notBefore: str | None = None
    createdAt: str | None = None
    scheduleId: str | None = None
    callerIP: str | None = None
