import uuid

from datetime import datetime

from fastapi import Body
from fastapi import Depends
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.models.api.document import IndexDocumentRequest
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
