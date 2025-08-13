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

from src.fai.api_models.index import IndexRequest
from src.fai.api_models.index import UpdateIndexRequest
from src.fai.app import fai_app
from src.fai.db_models.context import Context
from src.fai.dependencies import get_db
from src.fai.utils.index.get_tpuf_namespace import get_tpuf_namespace
from src.fai.utils.index.get_tpuf_namespace import get_tpuf_query_namespace
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
        db_context = Context(
            context_id=str(uuid.uuid4()),
            domain=domain,
            context=body.context,
            document=body.document,
            document_id=body.document_id,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(db_context)
        await db.commit()
        await db.refresh(db_context)
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
        db_context = await db.execute(
            select(Context).where(Context.document_id == document_id, Context.domain == domain)
        )
        db_context = db_context.scalar_one_or_none()
        if db_context:
            if body.context is not None:
                db_context.context = body.context
            if body.document is not None:
                db_context.document = body.document
            if body.is_active is not None:
                db_context.is_active = body.is_active
            await db.commit()
            await db.refresh(db_context)
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
        db_context = await db.execute(
            select(Context).where(Context.document_id == document_id, Context.domain == domain)
        )
        db_context = db_context.scalar_one_or_none()
        if db_context:
            return JSONResponse(content=jsonable_encoder(db_context))
        return JSONResponse(content=jsonable_encoder({"message": "Document not found"}))

    except Exception as e:
        LOGGER.exception("Failed to get document context")
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

        total_count = await db.scalar(select(func.count()).select_from(Context).where(Context.domain == domain))

        stmt = select(Context).where(Context.domain == domain).offset(offset).limit(limit)
        result = await db.execute(stmt)
        documents = result.scalars().all()

        response = {
            "documents": jsonable_encoder(documents),
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
            },
        }

        return JSONResponse(content=response)

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
        target_namespace_id = get_tpuf_query_namespace(domain)
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
