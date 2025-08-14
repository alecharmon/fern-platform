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
from src.fai.models.api.guidance import IndexGuidanceRequest
from src.fai.models.api.guidance import UpdateGuidanceRequest
from src.fai.models.db.guidance import Guidance
from src.fai.utils.turbopuffer.namespace import get_guidance_index_name
from src.fai.utils.turbopuffer.namespace import get_query_index_name
from src.fai.utils.turbopuffer.sync import sync_guidance_db_to_tpuf
from src.fai.utils.turbopuffer.sync import sync_index_to_target
from src.settings import CONFIG
from src.settings import LOGGER


@fai_app.post("/guidance/{domain}/create")
async def index_guidance(
    domain: str,
    body: IndexGuidanceRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        new_db_guidance = Guidance(
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
        return JSONResponse(content=jsonable_encoder({"message": "Guidance indexed successfully"}))

    except Exception as e:
        LOGGER.exception("Failed to index guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.patch("/guidance/{domain}/{guidance_id}")
async def update(
    domain: str,
    guidance_id: str,
    body: UpdateGuidanceRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_guidance = await db.execute(select(Guidance).where(Guidance.id == guidance_id, Guidance.domain == domain))
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
            return JSONResponse(content=jsonable_encoder({"message": "Guidance updated successfully"}))
        return JSONResponse(status_code=404, content=jsonable_encoder({"message": "Guidance not found"}))

    except Exception as e:
        LOGGER.exception("Failed to update guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.delete("/guidance/{domain}/{guidance_id}")
async def delete_guidance_by_id(
    domain: str,
    guidance_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_guidance = await db.execute(select(Guidance).where(Guidance.id == guidance_id, Guidance.domain == domain))
        db_guidance = db_guidance.scalar_one_or_none()
        if db_guidance:
            await db.delete(db_guidance)
            await db.commit()
            await sync_guidance_db_to_tpuf(domain, db)
            await sync_index_to_target(domain, get_guidance_index_name(), get_query_index_name())
            LOGGER.info(f"Deleted guidance {guidance_id} for domain: {domain}")
            return JSONResponse(content=jsonable_encoder({"message": "Guidance deleted successfully"}))
        return JSONResponse(content=jsonable_encoder({"message": "Guidance not found"}))

    except Exception as e:
        LOGGER.exception("Failed to delete guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get("/guidance/{domain}/{guidance_id}")
async def get_guidance_by_id(
    domain: str,
    guidance_id: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    try:
        db_guidance = await db.execute(select(Guidance).where(Guidance.id == guidance_id, Guidance.domain == domain))
        db_guidance = db_guidance.scalar_one_or_none()
        if db_guidance:
            return JSONResponse(content=jsonable_encoder(db_guidance.to_api()))
        return JSONResponse(content=jsonable_encoder({"message": "Guidance not found"}))

    except Exception as e:
        LOGGER.exception("Failed to get guidance")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.get("/guidance/{domain}")
async def get_guidances(
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

        total_count = await db.scalar(select(func.count()).select_from(Guidance).where(Guidance.domain == domain))

        stmt = select(Guidance).where(Guidance.domain == domain).offset(offset).limit(limit)
        result = await db.execute(stmt)
        guidances = result.scalars().all()

        response = {
            "guidances": [guidance.to_api() for guidance in guidances],
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
        LOGGER.exception("Bad request when getting guidances")
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        LOGGER.exception("Failed to get guidances")
        return JSONResponse(status_code=500, content={"detail": str(e)})
