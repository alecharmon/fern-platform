import uuid
from datetime import datetime

from fastapi import (
    Body,
    Depends,
    HTTPException,
)
from fastapi import Query as QueryParam
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.models.api.commons.pagination import PaginationResponse
from src.fai.models.api.document_api import (
    CreateDocumentRequest,
    CreateDocumentResponse,
    DeleteDocumentRequest,
    DeleteDocumentResponse,
    GetDocumentResponse,
    GetDocumentsResponse,
    UpdateDocumentRequest,
    UpdateDocumentResponse,
)
from src.fai.models.db.document_db import DocumentDb
from src.fai.utils.document.token_utils import (
    maybe_chunk_document,
)
from src.fai.utils.turbopuffer.namespace import (
    get_document_index_name,
    get_query_index_name,
)
from src.fai.utils.turbopuffer.sync import (
    sync_document_db_to_tpuf,
    sync_index_to_target,
)
from src.settings import LOGGER


@fai_app.post(
    "/document/{domain}/create",
    response_model=list[CreateDocumentResponse],
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def create_document(
    domain: str,
    body: CreateDocumentRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        created_document_ids = []

        chunks = maybe_chunk_document(body.chunk or body.document)

        for chunk in chunks:
            document_id = str(uuid.uuid4())
            new_db_document = DocumentDb(
                id=document_id,
                domain=domain,
                chunk=chunk,
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
            created_document_ids.append(document_id)
        await db.commit()
        await db.refresh(new_db_document)
        await sync_document_db_to_tpuf(domain, db)
        await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())
        LOGGER.info(f"Indexed document {new_db_document.id} for domain: {domain}")
        return JSONResponse(
            jsonable_encoder([CreateDocumentResponse(document_id=document_id) for document_id in created_document_ids])
        )

    except Exception as e:
        LOGGER.exception("Failed to index document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/document/{domain}/batch-create",
    response_model=list[CreateDocumentResponse],
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def batch_create_document(
    domain: str,
    body: list[CreateDocumentRequest] = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        created_document_ids = []

        for document in body:
            chunks = maybe_chunk_document(document.chunk or document.document)

            for chunk in chunks:
                document_id = str(uuid.uuid4())
                new_db_document = DocumentDb(
                    id=document_id,
                    domain=domain,
                    chunk=chunk,
                    document=document.document,
                    title=document.title,
                    url=document.url,
                    version=document.version,
                    keywords=document.keywords,
                    authed=document.authed,
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                )

                db.add(new_db_document)
                created_document_ids.append(document_id)
                LOGGER.info(f"Created document {document_id} for domain: {domain}")

        await db.commit()
        await sync_document_db_to_tpuf(domain, db)
        await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())

        return JSONResponse(
            jsonable_encoder([CreateDocumentResponse(document_id=document_id) for document_id in created_document_ids])
        )

    except Exception as e:
        LOGGER.exception("Failed to batch create documents")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.patch(
    "/document/{domain}/{document_id}",
    response_model=UpdateDocumentResponse,
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def update_document(
    domain: str,
    document_id: str,
    body: UpdateDocumentRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_document = await db.execute(
            select(DocumentDb).where(DocumentDb.id == document_id, DocumentDb.domain == domain)
        )
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
            return JSONResponse(jsonable_encoder(UpdateDocumentResponse(document=db_document.to_api())))
        return JSONResponse(status_code=404, content=jsonable_encoder({"message": "Document not found"}))

    except Exception as e:
        LOGGER.exception("Failed to update document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete(
    "/document/{domain}/delete",
    response_model=DeleteDocumentResponse,
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def delete_document_by_id(
    domain: str,
    body: DeleteDocumentRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_document = await db.execute(
            select(DocumentDb).where(DocumentDb.id == body.document_id, DocumentDb.domain == domain)
        )
        db_document = db_document.scalar_one_or_none()
        if db_document:
            await db.delete(db_document)
            await db.commit()
            await sync_document_db_to_tpuf(domain, db)
            await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())
            LOGGER.info(f"Deleted document {body.document_id} for domain: {domain}")
            return JSONResponse(jsonable_encoder(DeleteDocumentResponse(success=True)))
        return JSONResponse(jsonable_encoder(DeleteDocumentResponse(success=False)))

    except Exception as e:
        LOGGER.exception("Failed to delete document")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete(
    "/document/{domain}/batch-delete",
    response_model=DeleteDocumentResponse,
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def batch_delete_document(
    domain: str,
    body: list[DeleteDocumentRequest] = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        deleted_count = 0

        for document in body:
            db_document = await db.execute(
                select(DocumentDb).where(DocumentDb.id == document.document_id, DocumentDb.domain == domain)
            )
            db_document = db_document.scalar_one_or_none()
            if db_document:
                await db.delete(db_document)
                deleted_count += 1
                LOGGER.info(f"Deleted document {document.document_id} for domain: {domain}")

        if deleted_count > 0:
            await db.commit()
            await sync_document_db_to_tpuf(domain, db)
            await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())
            return JSONResponse(jsonable_encoder(DeleteDocumentResponse(success=True)))
        else:
            return JSONResponse(jsonable_encoder(DeleteDocumentResponse(success=False)))

    except Exception as e:
        LOGGER.exception("Failed to batch delete documents")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get(
    "/document/{domain}/{document_id}",
    response_model=GetDocumentResponse,
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def get_document_by_id(
    domain: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        document = await db.execute(select(DocumentDb).where(DocumentDb.id == document_id, DocumentDb.domain == domain))
        document = document.scalar_one_or_none()
        if not document:
            return JSONResponse(status_code=500, content={"message": "Document not found"})
        document_response = document.to_api()
        return JSONResponse(jsonable_encoder(GetDocumentResponse(document=document_response)))

    except Exception as e:
        LOGGER.exception("Failed to get document")
        return JSONResponse(status_code=500, content={"message": str(e)})


@fai_app.get(
    "/document/{domain}", response_model=GetDocumentsResponse, openapi_extra={"x-fern-audiences": ["customers"]}
)
async def get_documents(
    domain: str,
    page: int | None = QueryParam(default=None, description="The page number for pagination"),
    limit: int | None = QueryParam(default=None, description="The number of documents per page"),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        if page is None or page < 1:
            raise HTTPException(status_code=400, detail="page must be >= 1")
        if limit is None or limit < 1 or limit > 1000:
            raise HTTPException(status_code=400, detail="limit must be between 1 and 1000")

        offset = (page - 1) * limit

        total_count = await db.scalar(select(func.count()).select_from(DocumentDb).where(DocumentDb.domain == domain))

        stmt = select(DocumentDb).where(DocumentDb.domain == domain).offset(offset).limit(limit)
        result = await db.execute(stmt)
        documents = result.scalars().all()

        response = GetDocumentsResponse(
            documents=[document.to_api() for document in documents],
            pagination=PaginationResponse(
                total=total_count,
                page=page,
                limit=limit,
            ),
        )

        return JSONResponse(jsonable_encoder(response))

    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    except ValueError as e:
        LOGGER.exception("Bad request when getting documents")
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        LOGGER.exception("Failed to get documents")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete(
    "/document/{domain}/delete-all",
    response_model=DeleteDocumentResponse,
    openapi_extra={"x-fern-audiences": ["customers"]},
)
async def delete_all_documents(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        documents = await db.execute(select(DocumentDb).where(DocumentDb.domain == domain))
        documents = documents.scalars().all()
        for document in documents:
            await db.delete(document)
        await db.commit()
        await sync_document_db_to_tpuf(domain, db)
        await sync_index_to_target(domain, get_document_index_name(), get_query_index_name())
        return JSONResponse(jsonable_encoder(DeleteDocumentResponse(success=True)))
    except Exception as e:
        LOGGER.exception("Failed to delete all documents")
        return JSONResponse(status_code=500, content={"detail": str(e)})
