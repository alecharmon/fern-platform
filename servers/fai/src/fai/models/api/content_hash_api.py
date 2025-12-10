"""API models for content hash routes."""

from pydantic import BaseModel


class ContentHashEntry(BaseModel):
    """A single content hash entry."""

    parent_id: str
    content_hash: str
    indexed_at: str | None = None


class ContentHashUpsertEntry(BaseModel):
    """Entry for upserting a content hash (without timestamps)."""

    parent_id: str
    content_hash: str


class BatchGetContentHashesRequest(BaseModel):
    """Request to get content hashes. If parent_ids is empty, gets all hashes for domain."""

    parent_ids: list[str] = []


class BatchGetContentHashesResponse(BaseModel):
    """Response with content hash entries."""

    entries: list[ContentHashEntry]


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
