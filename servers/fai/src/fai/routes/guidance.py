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
from src.fai.models.api.guidance_api import (
    CreateGuidanceRequest,
    CreateGuidanceResponse,
    DeleteGuidanceResponse,
    GetGuidanceResponse,
    GetGuidancesResponse,
    UpdateGuidanceRequest,
    UpdateGuidanceResponse,
)
from src.fai.models.db.guidance_db import GuidanceDb
from src.fai.utils.turbopuffer.namespace import (
    get_guidance_index_name,
    get_query_index_name,
)
from src.fai.utils.turbopuffer.sync import (
    sync_guidance_db_to_tpuf,
    sync_index_to_target,
)
from src.settings import LOGGER


@fai_app.post("/guidance/{domain}/create", response_model=CreateGuidanceResponse)
async def create_guidance(
    domain: str,
    body: CreateGuidanceRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        new_db_guidance = GuidanceDb(
            id=str(uuid.uuid4()),
            domain=domain,
            context=body.context,
            document=body.document,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        db.add(new_db_guidance)
        await db.commit()
        await db.refresh(new_db_guidance)
        await sync_guidance_db_to_tpuf(domain, db)
        await sync_index_to_target(domain, get_guidance_index_name(), get_query_index_name())
        LOGGER.info(f"Indexed guidance {new_db_guidance.id} for domain: {domain}")
        return JSONResponse(jsonable_encoder(CreateGuidanceResponse(guidance_id=new_db_guidance.id)))

    except Exception as e:
        LOGGER.exception("Failed to index guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.patch("/guidance/{domain}/{guidance_id}", response_model=UpdateGuidanceResponse)
async def update(
    domain: str,
    guidance_id: str,
    body: UpdateGuidanceRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_guidance = await db.execute(
            select(GuidanceDb).where(GuidanceDb.id == guidance_id, GuidanceDb.domain == domain)
        )
        db_guidance = db_guidance.scalar_one_or_none()
        if db_guidance:
            if body.context is not None:
                db_guidance.context = body.context
            if body.document is not None:
                db_guidance.document = body.document
            db_guidance.updated_at = datetime.now()
            db.add(db_guidance)
            await db.commit()
            await db.refresh(db_guidance)
            await sync_guidance_db_to_tpuf(domain, db)
            await sync_index_to_target(domain, get_guidance_index_name(), get_query_index_name())
            LOGGER.info(f"Updated guidance {guidance_id} for domain: {domain}")
            return JSONResponse(jsonable_encoder(UpdateGuidanceResponse(guidance=db_guidance.to_api())))
        return JSONResponse(status_code=404, content=jsonable_encoder({"message": "Guidance not found"}))

    except Exception as e:
        LOGGER.exception("Failed to update guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete("/guidance/{domain}/{guidance_id}", response_model=DeleteGuidanceResponse)
async def delete_guidance_by_id(
    domain: str,
    guidance_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_guidance = await db.execute(
            select(GuidanceDb).where(GuidanceDb.id == guidance_id, GuidanceDb.domain == domain)
        )
        db_guidance = db_guidance.scalar_one_or_none()
        if db_guidance:
            await db.delete(db_guidance)
            await db.commit()
            await sync_guidance_db_to_tpuf(domain, db)
            await sync_index_to_target(domain, get_guidance_index_name(), get_query_index_name())
            LOGGER.info(f"Deleted guidance {guidance_id} for domain: {domain}")
            return JSONResponse(jsonable_encoder(DeleteGuidanceResponse(success=True)))
        return JSONResponse(jsonable_encoder(DeleteGuidanceResponse(success=False)))

    except Exception as e:
        LOGGER.exception("Failed to delete guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get("/guidance/{domain}/{guidance_id}", response_model=GetGuidanceResponse)
async def get_guidance_by_id(
    domain: str,
    guidance_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_guidance = await db.execute(
            select(GuidanceDb).where(GuidanceDb.id == guidance_id, GuidanceDb.domain == domain)
        )
        db_guidance = db_guidance.scalar_one_or_none()
        if db_guidance:
            return JSONResponse(jsonable_encoder(GetGuidanceResponse(guidance=db_guidance.to_api())))
        return JSONResponse(status_code=404, content={"detail": "Guidance not found"})

    except Exception as e:
        LOGGER.exception("Failed to get guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get("/guidance/{domain}", response_model=GetGuidancesResponse)
async def get_guidances(
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

        total_count = await db.scalar(select(func.count()).select_from(GuidanceDb).where(GuidanceDb.domain == domain))

        stmt = select(GuidanceDb).where(GuidanceDb.domain == domain).offset(offset).limit(limit)
        result = await db.execute(stmt)
        guidances = result.scalars().all()

        response = GetGuidancesResponse(
            guidances=[guidance.to_api() for guidance in guidances],
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
        LOGGER.exception("Bad request when getting guidances")
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        LOGGER.exception("Failed to get guidances")
        return JSONResponse(status_code=500, content={"detail": str(e)})
