import hashlib
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
from turbopuffer import NOT_GIVEN
from turbopuffer import AsyncTurbopuffer
from turbopuffer.types.row import Row

from fai.db_models.document import Document
from src.fai.api_models.index import IndexRequest
from src.fai.api_models.index import UpdateIndexRequest
from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.utils.index.get_tpuf_namespace import get_query_index_name
from src.fai.utils.index.get_tpuf_namespace import get_tpuf_namespace
from src.settings import CONFIG
from src.settings import LOGGER
from src.settings import VARIABLES


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
async def sync_index(
    domain: str,
    index_name: str,
) -> JSONResponse:
    def prefixed_id(namespace: str, original_id: str, max_len: int = 64) -> str:
        new_id = f"{namespace}:{original_id}"
        if len(new_id.encode("utf-8")) <= max_len:
            return new_id
        hashed = hashlib.sha256(original_id.encode("utf-8")).hexdigest()[:16]
        short_ns = namespace[: max_len - len(hashed) - 1]
        return f"{short_ns}:{hashed}"

    try:
        source_namespace_id = get_tpuf_namespace(domain, index_name)
        query_index_name = get_query_index_name()
        target_namespace_id = get_tpuf_namespace(domain, query_index_name)
        LOGGER.info(f"Syncing index {source_namespace_id} to {target_namespace_id} for domain {domain}")
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            source_ns = tpuf_client.namespace(source_namespace_id)
            target_ns = tpuf_client.namespace(target_namespace_id)

            await target_ns.write(delete_by_filter=["source", "Eq", index_name])

            last_id = None
            while True:
                result = await source_ns.query(
                    rank_by=("id", "asc"),
                    top_k=1000,
                    include_attributes=True,
                    filters=("id", "Gt", last_id) if last_id is not None else NOT_GIVEN,
                )

                prefixed_rows = []
                for row in result.rows:
                    new_row = Row.from_dict(row.model_dump())
                    new_row.id = prefixed_id(source_namespace_id, row.id)
                    new_row.source = index_name
                    prefixed_rows.append(new_row)

                source_schema = await source_ns.schema()
                await target_ns.write(
                    upsert_rows=prefixed_rows,
                    distance_metric="cosine_distance",
                    schema={
                        **source_schema,
                        "source": "string",
                    },
                )

                if len(result.rows) < 1000:
                    break
                last_id = result.rows[-1].id
        return JSONResponse(content=jsonable_encoder({"message": "Index synced successfully"}))

    except Exception as e:
        LOGGER.exception("Failed to sync index")
        return JSONResponse(status_code=500, content={"detail": str(e)})
