import uuid

from datetime import datetime

from fastapi import Body
from fastapi import Depends
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.models.api.index import IndexRequest
from src.fai.models.api.index import UpdateIndexRequest
from src.fai.models.db.document import Document
from src.fai.utils.turbopuffer.namespace import get_query_index_name
from src.fai.utils.turbopuffer.sync import sync_db_to_tpuf
from src.fai.utils.turbopuffer.sync import sync_index_to_target
from src.settings import CONFIG
from src.settings import LOGGER


@fai_app.post("/index/{domain}")
async def index(
    domain: str,
    body: IndexRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        new_db_document = Document(
            id=str(uuid.uuid4()),
            domain=domain,
            context=body.context,
            document=body.document,
            document_id=body.document_id,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        exists_document_with_id = await db.scalar(
            select(Document).where(Document.document_id == body.document_id).where(Document.domain == domain)
        )
        if exists_document_with_id:
            return JSONResponse(
                status_code=400,
                content=jsonable_encoder({"message": "Document with this ID already exists for this domain"}),
            )

        db.add(new_db_document)
        await db.commit()
        await db.refresh(new_db_document)
        await sync_db_to_tpuf(domain, db, CONFIG.DOCUMENTS_INDEX_NAME)
        await sync_index_to_target(domain, CONFIG.DOCUMENTS_INDEX_NAME, get_query_index_name())
        LOGGER.info(f"Indexed document {body.document_id} for domain: {domain}")
        return JSONResponse(content=jsonable_encoder({"message": "Document indexed successfully"}))

    except Exception as e:
        LOGGER.exception("Failed to index document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post("/index/{domain}/update")
async def update(
    domain: str,
    document_id: str,
    body: UpdateIndexRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_document = await db.execute(
            select(Document).where(Document.document_id == document_id, Document.domain == domain)
        )
        db_document = db_document.scalar_one_or_none()
        if db_document:
            if body.context is not None:
                db_document.context = body.context
            if body.document is not None:
                db_document.document = body.document
            if body.is_active is not None:
                db_document.is_active = body.is_active
            await db.commit()
            await db.refresh(db_document)
            await sync_db_to_tpuf(domain, db, CONFIG.DOCUMENTS_INDEX_NAME)
            await sync_index_to_target(domain, CONFIG.DOCUMENTS_INDEX_NAME, get_query_index_name())
            LOGGER.info(f"Updated document {document_id} for domain: {domain}")
        return JSONResponse(content=jsonable_encoder({"message": "Document updated successfully"}))

    except Exception as e:
        LOGGER.exception("Failed to update document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get("/index/{domain}")
async def get_document_by_id(
    domain: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_document = await db.execute(
            select(Document).where(Document.document_id == document_id, Document.domain == domain)
        )
        db_document = db_document.scalar_one_or_none()
        if db_document:
            return JSONResponse(content=jsonable_encoder(db_document.to_api()))
        return JSONResponse(content=jsonable_encoder({"message": "Document not found"}))

    except Exception as e:
        LOGGER.exception("Failed to get document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get("/index/{domain}/documents")
async def get_documents(
    domain: str,
    page: int = 1,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        if page < 1:
            raise HTTPException(status_code=400, detail="page must be >= 1")
        if limit < 1 or limit > 1000:
            raise HTTPException(status_code=400, detail="limit must be between 1 and 1000")

        offset = (page - 1) * limit

        total_count = await db.scalar(select(func.count()).select_from(Document).where(Document.domain == domain))

        stmt = select(Document).where(Document.domain == domain).offset(offset).limit(limit)
        result = await db.execute(stmt)
        documents = result.scalars().all()

        response = {
            "documents": [document.to_api() for document in documents],
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
            },
        }

        return JSONResponse(content=jsonable_encoder(response))

    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    except ValueError as e:
        LOGGER.exception("Bad request when getting documents")
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        LOGGER.exception("Failed to get documents")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post("/index/{domain}/sync")
async def sync_index_to_query_index(
    domain: str,
    index_name: str,
) -> JSONResponse:
    try:
        await sync_index_to_target(domain, index_name, get_query_index_name())
        return JSONResponse(content=jsonable_encoder({"message": "Index synced successfully"}))

    except Exception as e:
        LOGGER.exception("Failed to sync index")
        return JSONResponse(status_code=500, content={"detail": str(e)})
