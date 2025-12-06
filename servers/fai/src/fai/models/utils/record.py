from datetime import UTC, datetime

from pydantic import BaseModel, Field


class TurbopufferRecord(BaseModel):
    id: str
    vector: list[float]
    chunk: str
    document: str
    title: str
    url: str
    version: str | None = None
    product: str | None = None
    keywords: list[str] | None = None
    authed: bool | None = None
    content_type: str | None = None
    breadcrumbs: str | list[str] | None = None
    chunk_index: int | None = None
    parent_id: str | None = None
    parent_content_hash: str | None = None
    indexed_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
