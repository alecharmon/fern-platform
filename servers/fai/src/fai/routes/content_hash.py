"""
Content hash CRUD routes for FAI.

These routes provide simple read/write operations for content hashes.
The actual diffing logic lives in the fai-reindexing service.
"""

from datetime import UTC, datetime

from fastapi import Body, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import ask_ai_enabled, get_db, strip_domain, verify_token
from fai.models.api.content_hash_api import (
    BatchGetContentHashesRequest,
    BatchGetContentHashesResponse,
    BatchUpsertContentHashesRequest,
    BatchUpsertContentHashesResponse,
    ContentHashEntry,
    DeleteContentHashesRequest,
    DeleteContentHashesResponse,
)
from fai.models.db.content_hash_db import ContentHashDb
from fai.settings import LOGGER


@fai_app.post(
    "/content-hash/{domain}/batch-get",
    response_model=BatchGetContentHashesResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def batch_get_content_hashes(
    domain: str,
    body: BatchGetContentHashesRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> BatchGetContentHashesResponse:
    """
    Get content hashes for multiple parent_ids.
    If parent_ids is empty, returns all content hashes for the domain.
    """
    stripped_domain = strip_domain(domain)
    try:
        if body.parent_ids:
            stmt = select(ContentHashDb).where(
                ContentHashDb.domain == stripped_domain, ContentHashDb.parent_id.in_(body.parent_ids)
            )
        else:
            stmt = select(ContentHashDb).where(ContentHashDb.domain == stripped_domain)

        result = await db.execute(stmt)
        hashes = result.scalars().all()

        entries = [
            ContentHashEntry(
                parent_id=h.parent_id,
                content_hash=h.content_hash,
                indexed_at=h.indexed_at.isoformat(),
            )
            for h in hashes
        ]

        return JSONResponse(jsonable_encoder(BatchGetContentHashesResponse(entries=entries)))

    except Exception as e:
        LOGGER.exception(f"Failed to get content hashes for domain {stripped_domain}")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/content-hash/{domain}/batch-upsert",
    response_model=BatchUpsertContentHashesResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def batch_upsert_content_hashes(
    domain: str,
    body: BatchUpsertContentHashesRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> BatchUpsertContentHashesResponse:
    """
    Upsert content hashes for multiple parent_ids.
    Creates new records or updates existing ones.
    """
    try:
        upserted_count = 0

        for entry in body.entries:
            stmt = select(ContentHashDb).where(
                ContentHashDb.domain == domain, ContentHashDb.parent_id == entry.parent_id
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                existing.content_hash = entry.content_hash
                existing.updated_at = datetime.now(UTC)
            else:
                new_hash = ContentHashDb(domain=domain, parent_id=entry.parent_id, content_hash=entry.content_hash)
                db.add(new_hash)

            upserted_count += 1

        await db.commit()

        LOGGER.info(f"Upserted {upserted_count} content hashes for domain {domain}")
        return BatchUpsertContentHashesResponse(upserted_count=upserted_count)

    except Exception as e:
        LOGGER.exception(f"Failed to upsert content hashes for domain {domain}")
        await db.rollback()
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete(
    "/content-hash/{domain}/delete",
    response_model=DeleteContentHashesResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def delete_content_hashes(
    domain: str,
    body: DeleteContentHashesRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> DeleteContentHashesResponse:
    """
    Delete content hashes for multiple parent_ids.
    """
    try:
        if not body.parent_ids:
            return DeleteContentHashesResponse(deleted_count=0)

        stmt = delete(ContentHashDb).where(ContentHashDb.domain == domain, ContentHashDb.parent_id.in_(body.parent_ids))
        result = await db.execute(stmt)
        await db.commit()

        deleted_count = result.rowcount or 0

        LOGGER.info(f"Deleted {deleted_count} content hashes for domain {domain}")
        return DeleteContentHashesResponse(deleted_count=deleted_count)

    except Exception:
        LOGGER.exception(f"Failed to delete content hashes for domain {domain}")
        await db.rollback()
        raise
