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
from src.fai.models.api.document import IndexDocumentRequest
from src.fai.models.api.document import UpdateDocumentRequest
from src.fai.models.db.document import Document
from src.fai.utils.turbopuffer.namespace import get_document_index_name
from src.fai.utils.turbopuffer.namespace import get_query_index_name
from src.fai.utils.turbopuffer.sync import sync_document_db_to_tpuf
from src.fai.utils.turbopuffer.sync import sync_index_to_target
from src.settings import LOGGER


@fai_app.post("/document/{domain}/create")
async def index_document(
    domain: str,
    body: IndexDocumentRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        new_db_document = Document(
            id=str(uuid.uuid4()),
            domain=domain,
            chunk=body.chunk or body.document,
            document=body.document,
            title=body.title,
            url=body.url,
            version=body.version,
            keywords=body.keywords,
            authed=body.authed,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        db.add(new_db_document)
        await db.commit()
        await db.refresh(new_db_document)
        await sync_document_db_to_tpuf(domain, db)
        await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())
        LOGGER.info(f"Indexed document {new_db_document.id} for domain: {domain}")
        return JSONResponse(content={"document_id": new_db_document.id})

    except Exception as e:
        LOGGER.exception("Failed to index document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.patch("/document/{domain}/{document_id}")
async def update(
    domain: str,
    document_id: str,
    body: UpdateDocumentRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_document = await db.execute(select(Document).where(Document.id == document_id, Document.domain == domain))
        db_document = db_document.scalar_one_or_none()
        if db_document:
            if body.document is not None:
                db_document.document = body.document
            if body.chunk is not None:
                db_document.chunk = body.chunk
            if body.title is not None:
                db_document.title = body.title
            if body.url is not None:
                db_document.url = body.url
            if body.version is not None:
                db_document.version = body.version
            if body.keywords is not None:
                db_document.keywords = body.keywords
            if body.authed is not None:
                db_document.authed = body.authed
            db_document.updated_at = datetime.now()
            db.add(db_document)
            await db.commit()
            await db.refresh(db_document)
            await sync_document_db_to_tpuf(domain, db)
            await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())
            LOGGER.info(f"Updated document {document_id} for domain: {domain}")
            return JSONResponse(content=jsonable_encoder(db_document.to_api()))
        return JSONResponse(status_code=404, content=jsonable_encoder({"message": "Document not found"}))

    except Exception as e:
        LOGGER.exception("Failed to update document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete("/document/{domain}/{document_id}")
async def delete_document_by_id(
    domain: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_document = await db.execute(select(Document).where(Document.id == document_id, Document.domain == domain))
        db_document = db_document.scalar_one_or_none()
        if db_document:
            await db.delete(db_document)
            await db.commit()
            await sync_document_db_to_tpuf(domain, db)
            await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())
            LOGGER.info(f"Deleted document {document_id} for domain: {domain}")
            return JSONResponse(content=jsonable_encoder({"message": "Document deleted successfully"}))
        return JSONResponse(content=jsonable_encoder({"message": "Document not found"}))

    except Exception as e:
        LOGGER.exception("Failed to delete document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get("/document/{domain}/{document_id}")
async def get_document_by_id(
    domain: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        document = await db.execute(select(Document).where(Document.id == document_id, Document.domain == domain))
        document = document.scalar_one_or_none()
        if not document:
            return JSONResponse(status_code=500, content={"message": "Document not found"})
        return JSONResponse(content=jsonable_encoder(document.to_api()))

    except Exception as e:
        LOGGER.exception("Failed to get document")
        return JSONResponse(status_code=500, content={"message": str(e)})


@fai_app.get("/document/{domain}")
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
