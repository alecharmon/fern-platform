import uuid
from datetime import datetime

from fastapi import (
    Body,
    Depends,
    HTTPException,
)
from fastapi import Query as QueryParam
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    ask_ai_enabled,
    get_db,
    verify_token,
)
from fai.models.api.code_api import (
    CreateCodeRequest,
    CreateCodeResponse,
    DeleteCodeRequest,
    DeleteCodeResponse,
    GetCodeEntriesResponse,
    GetCodeResponse,
)
from fai.models.api.commons.pagination import PaginationResponse
from fai.models.db.code_db import CodeDb
from fai.settings import LOGGER
from fai.utils.document.token_utils import maybe_chunk_document
from fai.utils.turbopuffer.namespace import (
    get_code_index_name,
    get_query_index_name,
)
from fai.utils.turbopuffer.sync import (
    delete_code_from_tpuf,
    delete_documents_from_query_index,
    sync_code_db_to_tpuf,
    sync_code_to_tpuf,
    sync_documents_to_query_index,
    sync_index_to_target,
)


@fai_app.post(
    "/code/{domain}/create",
    response_model=list[CreateCodeResponse],
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def create_code(
    domain: str,
    body: CreateCodeRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> list[CreateCodeResponse]:
    created_code_ids = []

    chunks = await maybe_chunk_document(body.chunk or body.document)

    for chunk in chunks:
        code_id = str(uuid.uuid4())
        new_db_code = CodeDb(
            id=code_id,
            domain=domain,
            chunk=chunk,
            document=body.document,
            title=body.title,
            url=body.url,
            version=None,
            product=None,
            keywords=body.keywords,
            authed=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(new_db_code)
        created_code_ids.append(code_id)
    await db.commit()
    await db.refresh(new_db_code)
    await sync_code_to_tpuf(domain, created_code_ids, db)
    await sync_documents_to_query_index(
        domain, created_code_ids, get_code_index_name(), get_query_index_name()
    )
    LOGGER.info(f"Indexed code {new_db_code.id} for domain: {domain}")
    return [CreateCodeResponse(code_id=code_id) for code_id in created_code_ids]


@fai_app.post(
    "/code/{domain}/batch-create",
    response_model=list[CreateCodeResponse],
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def batch_create_code(
    domain: str,
    body: list[CreateCodeRequest] = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> list[CreateCodeResponse]:
    created_code_ids = []

    for code_doc in body:
        chunks = await maybe_chunk_document(code_doc.chunk or code_doc.document)

        for chunk in chunks:
            code_id = str(uuid.uuid4())
            new_db_code = CodeDb(
                id=code_id,
                domain=domain,
                chunk=chunk,
                document=code_doc.document,
                title=code_doc.title,
                url=code_doc.url,
                version=None,
                product=None,
                keywords=code_doc.keywords,
                authed=None,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )

            db.add(new_db_code)
            created_code_ids.append(code_id)
            LOGGER.info(f"Created code {code_id} for domain: {domain}")

    await db.commit()
    await sync_code_to_tpuf(domain, created_code_ids, db)
    await sync_documents_to_query_index(
        domain, created_code_ids, get_code_index_name(), get_query_index_name()
    )

    return [CreateCodeResponse(code_id=code_id) for code_id in created_code_ids]


@fai_app.get(
    "/code/{domain}/{code_id}",
    response_model=GetCodeResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def get_code_by_id(
    domain: str,
    code_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> GetCodeResponse:
    code = await db.execute(select(CodeDb).where(CodeDb.id == code_id, CodeDb.domain == domain))
    code = code.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    return GetCodeResponse(document=code.to_api())


@fai_app.get(
    "/code/{domain}",
    response_model=GetCodeEntriesResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def get_code(
    domain: str,
    page: int | None = QueryParam(default=None, description="The page number for pagination"),
    limit: int | None = QueryParam(default=None, description="The number of code entries per page"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> GetCodeEntriesResponse:
    if page is None or page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if limit is None or limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 1000")

    offset = (page - 1) * limit

    total_count = await db.scalar(select(func.count()).select_from(CodeDb).where(CodeDb.domain == domain))

    stmt = select(CodeDb).where(CodeDb.domain == domain).offset(offset).limit(limit)
    result = await db.execute(stmt)
    code_entries = result.scalars().all()

    return GetCodeEntriesResponse(
        documents=[code.to_api() for code in code_entries],
        pagination=PaginationResponse(
            total=total_count,
            page=page,
            limit=limit,
        ),
    )


@fai_app.delete(
    "/code/{domain}/delete",
    response_model=DeleteCodeResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def delete_code_by_id(
    domain: str,
    body: DeleteCodeRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> DeleteCodeResponse:
    db_code = await db.execute(select(CodeDb).where(CodeDb.id == body.code_id, CodeDb.domain == domain))
    db_code = db_code.scalar_one_or_none()
    if db_code:
        await db.delete(db_code)
        await db.commit()
        await delete_code_from_tpuf(domain, [body.code_id])
        await delete_documents_from_query_index(
            domain, [body.code_id], get_code_index_name(), get_query_index_name()
        )
        LOGGER.info(f"Deleted code {body.code_id} for domain: {domain}")
        return DeleteCodeResponse(success=True)
    return DeleteCodeResponse(success=False)


@fai_app.delete(
    "/code/{domain}/delete-all",
    response_model=DeleteCodeResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def delete_all_code(
    domain: str, db: AsyncSession = Depends(get_db), _: None = Depends(verify_token), __: None = Depends(ask_ai_enabled)
) -> DeleteCodeResponse:
    code_entries = await db.execute(select(CodeDb).where(CodeDb.domain == domain))
    code_entries = code_entries.scalars().all()
    for code in code_entries:
        await db.delete(code)
    await db.commit()
    await sync_code_db_to_tpuf(domain, db)
    await sync_index_to_target(domain, get_code_index_name(), get_query_index_name())
    return DeleteCodeResponse(success=True)
