"""
Content hash CRUD routes for FAI.

These routes provide simple read/write operations for content hashes.
The actual diffing logic lives in the fai-reindexing service.
"""

from datetime import datetime

from fastapi import Body, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import get_db, strip_domain, verify_token
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

        stmt = stmt.order_by(ContentHashDb.parent_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar()

        stmt = stmt.limit(body.limit).offset(body.offset)

        result = await db.execute(stmt)
        hashes = result.scalars().all()

        has_more = (body.offset + len(hashes)) < total_count

        entries = [
            ContentHashEntry(
                domain=h.domain,
                parent_id=h.parent_id,
                content_hash=h.content_hash,
                chunk_count=h.chunk_count,
                indexed_at=h.indexed_at.isoformat(),
            )
            for h in hashes
        ]

        return JSONResponse(
            jsonable_encoder(BatchGetContentHashesResponse(entries=entries, total_count=total_count, has_more=has_more))
        )

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
) -> BatchUpsertContentHashesResponse:
    """
    Upsert content hashes for multiple parent_ids.
    Creates new records or updates existing ones.
    """
    try:
        if not body.entries:
            return BatchUpsertContentHashesResponse(upserted_count=0)

        parent_ids = [entry.parent_id for entry in body.entries]
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain, ContentHashDb.parent_id.in_(parent_ids))
        result = await db.execute(stmt)
        existing_hashes = {h.parent_id: h for h in result.scalars().all()}

        now = datetime.utcnow()
        inserts = []

        for entry in body.entries:
            if entry.parent_id in existing_hashes:
                existing = existing_hashes[entry.parent_id]
                existing.content_hash = entry.content_hash
                existing.chunk_count = entry.chunk_count
                existing.updated_at = now
            else:
                inserts.append(
                    ContentHashDb(
                        domain=domain,
                        parent_id=entry.parent_id,
                        content_hash=entry.content_hash,
                        chunk_count=entry.chunk_count,
                    )
                )

        if inserts:
            db.add_all(inserts)

        await db.commit()

        upserted_count = len(body.entries)
        num_new = len(inserts)
        num_updated = len(body.entries) - len(inserts)
        LOGGER.info(
            f"Upserted {upserted_count} content hashes for domain {domain} " f"({num_new} new, {num_updated} updated)"
        )
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
