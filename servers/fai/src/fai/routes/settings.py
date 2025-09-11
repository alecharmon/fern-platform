from datetime import datetime
from urllib.parse import urlparse

import httpx
from fastapi import (
    Depends,
    Request,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.app import fai_app
from src.fai.dependencies import get_db
from src.fai.models.api.settings_api import (
    GetSettingsResponse,
    ToggleAskAiResponse,
    ToggleStatusResponse,
)
from src.fai.models.db.settings_db import SettingsDb
from src.fai.utils.get_venus_client import get_venus_client
from src.settings import LOGGER


@fai_app.get(
    "/settings/ask-ai",
    response_model=GetSettingsResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_settings(
    domain: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Get settings for a domain and organization."""
    try:
        token = get_token_from_auth_header(request.headers.get("Authorization"))
        if token is None:
            return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False, job_id=None)))

        venus_client = get_venus_client(token=token)
        is_fern_member = "fern" in venus_client.organization.get_org_ids_from_token()
        if not is_fern_member:
            return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False, job_id=None)))

        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        # if it has been reindexed, ask ai is enabled
        ask_ai_enabled = existing_record is not None and existing_record.last_reindex_time is not None
        job_id = existing_record.job_id if existing_record else None

        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=ask_ai_enabled, job_id=job_id)))
    except Exception:
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False, job_id=None)))


@fai_app.post(
    "/settings/ask-ai/toggle",
    response_model=ToggleAskAiResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def toggle_ask_ai(
    domain: str,
    org_name: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Toggle Ask AI setting and return job_id for tracking."""
    LOGGER.info(f"Toggling Ask AI for domain {domain} and org_name {org_name}")
    try:
        token = get_token_from_auth_header(request.headers.get("Authorization"))
        if token is None:
            return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

        venus_client = get_venus_client(token=token)
        is_fern_member = "fern" in venus_client.organization.get_org_ids_from_token()
        if not is_fern_member:
            return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

        stripped_domain = strip_domain(domain)

        # Check existing record
        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        job_id = None

        if existing_record and existing_record.last_reindex_time is not None and existing_record.job_id is None:
            # Disable Ask AI - clear the last_reindex_time but keep the record
            existing_record.last_reindex_time = None
            existing_record.job_id = None
            LOGGER.info(f"Disabled Ask AI for domain {stripped_domain}")
            await db.commit()
        else:
            # Enable Ask AI - either create new record or update existing one
            LOGGER.info(f"Enabling Ask AI and starting reindex for domain {stripped_domain}")

            # Start reindex and get job_id
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.get(
                        f"https://{domain}/api/fern-docs/search/v2/reindex/turbopuffer/start"
                    )
                    if response.status_code == 200:
                        job_id = response.json().get("job_id", None)
                        LOGGER.info(
                            f"Successfully started turbopuffer reindex for domain {stripped_domain}, job_id: {job_id}"
                        )
                    else:
                        LOGGER.error(f"Failed to start reindex for domain {stripped_domain}: {response.status_code}")
                        return JSONResponse(
                            content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False))
                        )
            except Exception as e:
                LOGGER.error(f"Failed to start reindex for domain {stripped_domain}: {e}")
                return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

            if existing_record:
                existing_record.job_id = job_id
                # Don't set last_reindex_time here - only when job completes
                await db.commit()
                LOGGER.info(f"Updated existing record for domain {stripped_domain}")
            else:
                new_record = SettingsDb(
                    domain=stripped_domain,
                    org_name=org_name,
                    job_id=job_id,
                    last_reindex_time=None,  # Don't set until job completes
                )
                db.add(new_record)
                await db.commit()
                await db.refresh(new_record)
                LOGGER.info(f"Created new record for domain {stripped_domain}")

            LOGGER.info(f"Enabled Ask AI for domain {stripped_domain}")

        # Determine if Ask AI is now enabled based on whether we have a last_reindex_time
        ask_ai_now_enabled = job_id is not None  # If we got a job_id, we're enabling; if not, we're disabling

        return JSONResponse(
            content=jsonable_encoder(
                ToggleAskAiResponse(success=True, job_id=job_id, ask_ai_enabled=ask_ai_now_enabled)
            )
        )

    except Exception:
        LOGGER.exception("Failed to toggle Ask AI")
        return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))


@fai_app.post(
    "/settings/ask-ai/reindex",
    response_model=ToggleAskAiResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def reindex_ask_ai(
    domain: str,
    org_name: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Manually trigger reindex for an already enabled Ask AI setup."""
    LOGGER.info(f"Manual reindex triggered for domain {domain} and org_name {org_name}")
    try:
        token = get_token_from_auth_header(request.headers.get("Authorization"))
        if token is None:
            return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

        venus_client = get_venus_client(token=token)
        is_fern_member = "fern" in venus_client.organization.get_org_ids_from_token()
        if not is_fern_member:
            return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

        stripped_domain = strip_domain(domain)

        # Check existing record - Ask AI must already be enabled
        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        if not existing_record or existing_record.last_reindex_time is None:
            # Ask AI is not enabled, cannot reindex
            return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

        if existing_record.job_id is not None:
            # Already reindexing, return existing job_id
            return JSONResponse(
                content=jsonable_encoder(
                    ToggleAskAiResponse(success=True, job_id=existing_record.job_id, ask_ai_enabled=True)
                )
            )

        # Start reindex and get job_id
        job_id = None
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(f"https://{domain}/api/fern-docs/search/v2/reindex/turbopuffer/start")
                if response.status_code == 200:
                    job_id = response.json().get("job_id", None)
                    LOGGER.info(
                        f"Successfully started turbopuffer reindex for domain {stripped_domain}, job_id: {job_id}"
                    )
                else:
                    LOGGER.error(f"Failed to start manual reindex for domain {stripped_domain}: {response.status_code}")
                    return JSONResponse(
                        content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=True))
                    )
        except Exception as e:
            LOGGER.error(f"Failed to start manual reindex for domain {stripped_domain}: {e}")
            return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=True)))

        # Update record with job_id but keep last_reindex_time (Ask AI stays enabled)
        existing_record.job_id = job_id
        await db.commit()
        LOGGER.info(f"Started manual reindex for domain {stripped_domain} with job_id: {job_id}")

        return JSONResponse(
            content=jsonable_encoder(ToggleAskAiResponse(success=True, job_id=job_id, ask_ai_enabled=True))
        )

    except Exception:
        LOGGER.exception("Failed to start manual reindex")
        return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=True)))


@fai_app.get(
    "/settings/ask-ai/toggle/status",
    response_model=ToggleStatusResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_toggle_status(
    domain: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Get the status of Ask AI toggle operation."""
    try:
        token = get_token_from_auth_header(request.headers.get("Authorization"))
        if token is None:
            return JSONResponse(
                content=jsonable_encoder(
                    ToggleStatusResponse(status="error", completed=False, failed=True, ask_ai_enabled=False)
                )
            )

        venus_client = get_venus_client(token=token)
        is_fern_member = "fern" in venus_client.organization.get_org_ids_from_token()
        if not is_fern_member:
            return JSONResponse(
                content=jsonable_encoder(
                    ToggleStatusResponse(status="error", completed=False, failed=True, ask_ai_enabled=False)
                )
            )

        stripped_domain = strip_domain(domain)

        # Get the settings record
        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        if not existing_record or not existing_record.job_id:
            # Ask AI is enabled if record exists AND has a non-null last_reindex_time
            ask_ai_enabled = existing_record is not None and existing_record.last_reindex_time is not None

            return JSONResponse(
                content=jsonable_encoder(
                    ToggleStatusResponse(
                        status="completed",
                        completed=True,
                        failed=False,
                        ask_ai_enabled=ask_ai_enabled,
                        job_id=None,
                        last_reindex_time=(
                            existing_record.last_reindex_time.isoformat()
                            if existing_record and existing_record.last_reindex_time
                            else None
                        ),
                    )
                )
            )

        # Check job status using the turbopuffer status endpoint
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"https://{domain}/api/fern-docs/search/v2/reindex/turbopuffer/status?job_id={existing_record.job_id}"
                )
                if response.status_code == 200:
                    status_data = response.json()

                    # If job is completed, clear the job_id and set completion time
                    if status_data.get("completed", False):
                        existing_record.job_id = None
                        existing_record.last_reindex_time = datetime.utcnow()
                        await db.commit()

                    return JSONResponse(
                        content=jsonable_encoder(
                            ToggleStatusResponse(
                                status=status_data.get("status", "unknown"),
                                completed=status_data.get("completed", False),
                                failed=status_data.get("failed", False),
                                ask_ai_enabled=True,
                                job_id=existing_record.job_id,
                                last_reindex_time=(
                                    existing_record.last_reindex_time.isoformat()
                                    if existing_record.last_reindex_time
                                    else None
                                ),
                            )
                        )
                    )
                else:
                    LOGGER.error(f"Failed to get job status: {response.status_code}")
                    return JSONResponse(
                        content=jsonable_encoder(
                            ToggleStatusResponse(
                                status="error",
                                completed=False,
                                failed=True,
                                ask_ai_enabled=True,
                                job_id=existing_record.job_id,
                            )
                        )
                    )
        except Exception as e:
            LOGGER.error(f"Failed to check job status: {e}")
            return JSONResponse(
                content=jsonable_encoder(
                    ToggleStatusResponse(
                        status="error", completed=False, failed=True, ask_ai_enabled=True, job_id=existing_record.job_id
                    )
                )
            )

    except Exception:
        LOGGER.exception("Failed to get toggle status")
        return JSONResponse(
            content=jsonable_encoder(
                ToggleStatusResponse(status="error", completed=False, failed=True, ask_ai_enabled=False)
            )
        )


def get_token_from_auth_header(auth_header: str) -> str | None:
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def strip_domain(url: str) -> str:
    """Extract domain from URL, removing protocol, path, and query parameters."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    return parsed.netloc
