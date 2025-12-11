"""API models for content hash routes."""

from pydantic import BaseModel, Field


class ContentHashEntry(BaseModel):
    """A single content hash entry."""

    domain: str
    parent_id: str
    content_hash: str
    chunk_count: int
    indexed_at: str | None = None


class ContentHashUpsertEntry(BaseModel):
    """Entry for upserting a content hash (without timestamps)."""

    parent_id: str
    content_hash: str
    chunk_count: int


class BatchGetContentHashesRequest(BaseModel):
    """Request to get content hashes. If parent_ids is empty, gets all hashes for domain."""

    parent_ids: list[str] = []
    limit: int = Field(default=1000, ge=1, le=1000, description="The number of content hashes to return")
    offset: int = Field(default=0, ge=0, description="The offset to start from")


class BatchGetContentHashesResponse(BaseModel):
    """Response with content hash entries."""

    entries: list[ContentHashEntry]
    total_count: int | None = None
    has_more: bool = False


class BatchUpsertContentHashesRequest(BaseModel):
    """Request to upsert multiple content hashes."""

    entries: list[ContentHashUpsertEntry]


class BatchUpsertContentHashesResponse(BaseModel):
    """Response after upserting content hashes."""

    upserted_count: int


class DeleteContentHashesRequest(BaseModel):
    """Request to delete content hashes for specific parent_ids."""

    parent_ids: list[str]


class DeleteContentHashesResponse(BaseModel):
    """Response after deleting content hashes."""

    deleted_count: int
