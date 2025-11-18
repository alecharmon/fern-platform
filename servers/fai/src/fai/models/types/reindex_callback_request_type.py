from typing import Literal

from pydantic import BaseModel


class ReindexCallbackRequest(BaseModel):
    """Callback payload from SQS reindexing worker when a reindex job completes."""

    status: Literal["success", "failure"]
    sourceMessageId: str
    domain: str | None = None
    url: str | None = None
