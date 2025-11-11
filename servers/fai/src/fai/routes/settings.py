from datetime import datetime
from typing import Literal

import httpx
from fastapi import (
    BackgroundTasks,
    Depends,
    Query,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    strip_domain,
    verify_token,
)
from fai.models.api.settings_api import (
    EnableAskAiRequest,
    EnableAskAiResponse,
    GetSettingsResponse,
    ToggleAskAiResponse,
    ToggleStatusResponse,
)
from fai.models.db.settings_db import SettingsDb
from fai.models.types.upstash_callback_request_type import UpstashCallbackRequest
from fai.settings import LOGGER


@fai_app.get(
    "/settings/ask-ai",
    response_model=GetSettingsResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_settings(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Get settings for a domain and organization."""
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        # TODO(sahil): remove this method after migrating + releasing fern-platform checks with get_docs_settings
        ask_ai_enabled = (
            existing_record is not None
            and existing_record.last_reindex_time is not None
            and existing_record.docs_enabled
        )
        job_id = existing_record.job_id if existing_record else None

        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=ask_ai_enabled, job_id=job_id)))
    except Exception:
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False, job_id=None)))


@fai_app.get(
    "/settings/ask-ai/docs",
    response_model=GetSettingsResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_docs_settings(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Get settings for a domain and organization."""
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        ask_ai_enabled = (
            existing_record is not None
            and existing_record.last_reindex_time is not None
            and existing_record.docs_enabled
        )
        job_id = existing_record.job_id if existing_record else None

        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=ask_ai_enabled, job_id=job_id)))
    except Exception:
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False, job_id=None)))


@fai_app.get(
    "/settings/ask-ai/slack",
    response_model=GetSettingsResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_slack_settings(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Get settings for a domain and organization."""
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        ask_ai_enabled = (
            existing_record is not None
            and existing_record.last_reindex_time is not None
            and existing_record.slack_enabled
        )
        job_id = existing_record.job_id if existing_record else None

        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=ask_ai_enabled, job_id=job_id)))
    except Exception:
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False, job_id=None)))


@fai_app.get(
    "/settings/ask-ai/discord",
    response_model=GetSettingsResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_discord_settings(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Get settings for a domain and organization."""
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        ask_ai_enabled = (
            existing_record is not None
            and existing_record.last_reindex_time is not None
            and existing_record.discord_enabled
        )
        job_id = existing_record.job_id if existing_record else None

        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=ask_ai_enabled, job_id=job_id)))
    except Exception:
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False, job_id=None)))


@fai_app.post(
    "/settings/ask-ai/enable",
    response_model=EnableAskAiResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def enable_ask_ai(
    request: EnableAskAiRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> EnableAskAiResponse:
    """Enable Ask AI for multiple domains with specified locations and trigger reindex.

    Args:
        request: Request containing domains, org_name, and locations to enable
    """
    LOGGER.info(f"Enabling Ask AI for domains {request.domains}, locations: {request.locations}")

    docs_enabled = "docs" in request.locations
    slack_enabled = "slack" in request.locations
    discord_enabled = "discord" in request.locations

    results = []

    for domain in request.domains:
        try:
            stripped_domain = strip_domain(domain)

            if not docs_enabled and not slack_enabled and not discord_enabled:
                LOGGER.warning(f"Skipping domain {domain}: no locations specified for enablement")
                results.append({"domain": domain, "success": False})
                continue

            existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
            existing_record = existing.scalar_one_or_none()

            if existing_record:
                existing_record.docs_enabled = docs_enabled
                existing_record.slack_enabled = slack_enabled
                existing_record.discord_enabled = discord_enabled
                await db.commit()
                LOGGER.info(f"Updated existing record for domain {stripped_domain}")
            else:
                new_record = SettingsDb(
                    domain=stripped_domain,
                    org_name=request.org_name,
                    job_id=None,
                    last_reindex_time=None,
                    is_preview=request.preview,
                    docs_enabled=docs_enabled,
                    slack_enabled=slack_enabled,
                    discord_enabled=discord_enabled,
                )
                db.add(new_record)
                await db.commit()
                await db.refresh(new_record)
                existing_record = new_record
                LOGGER.info(f"Created new record for domain {stripped_domain}")

            LOGGER.info(f"Starting reindex for domain {stripped_domain}")
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(
                    f"https://{domain}/api/fern-docs/search/v2/reindex/turbopuffer/start?deleteExisting=true"
                )
                if response.status_code == 200:
                    job_id = response.json().get("job_id", None)
                    LOGGER.info(
                        f"Successfully started turbopuffer reindex for domain {stripped_domain}, job_id: {job_id}"
                    )
                    existing_record.job_id = job_id
                    await db.commit()
                    results.append({"domain": domain, "success": True, "job_id": job_id})
                else:
                    LOGGER.error(f"Failed to start reindex for domain {stripped_domain}: {response.status_code}")
                    results.append({"domain": domain, "success": False})

        except Exception as e:
            LOGGER.exception(f"Failed to enable Ask AI for domain {domain}: {e}")
            results.append({"domain": domain, "success": False})

    overall_success = all(result["success"] for result in results)
    return EnableAskAiResponse(success=overall_success)


@fai_app.post(
    "/settings/ask-ai/toggle",
    response_model=ToggleAskAiResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def toggle_ask_ai(
    domain: str,
    org_name: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    preview: bool = False,
    locations: list[Literal["docs", "slack", "discord"]] | None = Query(None),
) -> JSONResponse:
    """Toggle Ask AI setting and return job_id for tracking.

    Args:
        domain: Domain to toggle Ask AI for
        org_name: Organization name
        preview: Whether this is a preview deployment
        locations: Optional list of locations to enable. Valid values: docs, slack, discord
    """
    LOGGER.info(f"Toggling Ask AI for domain {domain} and org_name {org_name}, locations: {locations}")
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        job_id = None

        if existing_record and existing_record.last_reindex_time is not None and existing_record.job_id is None:
            existing_record.last_reindex_time = None
            existing_record.job_id = None
            LOGGER.info(f"Disabled Ask AI for domain {stripped_domain}")
            await db.commit()
            background_tasks.add_task(revalidate_domain, domain)

        else:
            LOGGER.info(f"Enabling Ask AI and starting reindex for domain {stripped_domain}")
            try:
                async with httpx.AsyncClient(follow_redirects=True) as client:
                    response = await client.get(
                        f"https://{domain}/api/fern-docs/search/v2/reindex/turbopuffer/start?deleteExisting=true"
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
                if locations is not None:
                    existing_record.docs_enabled = "docs" in locations
                    existing_record.slack_enabled = "slack" in locations
                    existing_record.discord_enabled = "discord" in locations
                await db.commit()
                LOGGER.info(f"Updated existing record for domain {stripped_domain}")
            else:
                docs_enabled = True
                slack_enabled = True
                discord_enabled = True
                if locations is not None:
                    docs_enabled = "docs" in locations
                    slack_enabled = "slack" in locations
                    discord_enabled = "discord" in locations

                new_record = SettingsDb(
                    domain=stripped_domain,
                    org_name=org_name,
                    job_id=job_id,
                    last_reindex_time=None,
                    is_preview=preview,
                    docs_enabled=docs_enabled,
                    slack_enabled=slack_enabled,
                    discord_enabled=discord_enabled,
                )
                db.add(new_record)
                await db.commit()
                await db.refresh(new_record)
                existing_record = new_record
                LOGGER.info(f"Created new record for domain {stripped_domain}")

        ask_ai_now_enabled = existing_record.last_reindex_time is not None

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
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def reindex_ask_ai(
    domain: str,
    org_name: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Manually trigger reindex for an already enabled Ask AI setup."""
    LOGGER.info(f"Manual reindex triggered for domain {domain} and org_name {org_name}")
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        if not existing_record or existing_record.last_reindex_time is None:
            return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

        if existing_record.job_id is not None:
            return JSONResponse(
                content=jsonable_encoder(
                    ToggleAskAiResponse(success=True, job_id=existing_record.job_id, ask_ai_enabled=True)
                )
            )

        job_id = None
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(
                    f"https://{domain}/api/fern-docs/search/v2/reindex/turbopuffer/start?deleteExisting=true"
                )
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
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_toggle_status(
    domain: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> JSONResponse:
    """Get the status of Ask AI toggle operation."""
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            return JSONResponse(content=jsonable_encoder(ToggleStatusResponse(status="error", ask_ai_enabled=False)))

        if not existing_record.job_id:
            ask_ai_enabled = existing_record.last_reindex_time is not None

            return JSONResponse(
                content=jsonable_encoder(
                    ToggleStatusResponse(
                        status="completed",
                        ask_ai_enabled=ask_ai_enabled,
                        last_reindex_time=(
                            existing_record.last_reindex_time.isoformat() if existing_record.last_reindex_time else None
                        ),
                    )
                )
            )

        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(
                f"https://{domain}/api/fern-docs/search/v2/reindex/turbopuffer/status?job_id={existing_record.job_id}"
            )
            if response.status_code == 200:
                status_data = response.json()
                job_status = status_data.get("status", None)

                if job_status == "completed":
                    existing_record.job_id = None
                    existing_record.last_reindex_time = datetime.utcnow()
                    background_tasks.add_task(revalidate_domain, domain)
                elif job_status == "failed":
                    existing_record.job_id = None
                    existing_record.last_reindex_time = None

                await db.commit()

                return JSONResponse(
                    content=jsonable_encoder(
                        ToggleStatusResponse(
                            status=job_status or "failed",
                            ask_ai_enabled=True,
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
                            status="failed",
                            ask_ai_enabled=True,
                        )
                    )
                )

    except Exception:
        LOGGER.exception("Failed to get toggle status")
        return JSONResponse(content=jsonable_encoder(ToggleStatusResponse(status="failed", ask_ai_enabled=False)))


@fai_app.post(
    "/settings/reindex-preview-callback",
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def reindex_preview_callback(
    request: UpstashCallbackRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Handle callback from Upstash QStash when preview reindex completes."""
    try:
        LOGGER.info(f"Received reindex callback - status: {request.status}, messageId: {request.sourceMessageId}")

        if not request.sourceMessageId:
            LOGGER.error("No sourceMessageId provided in callback")
            return JSONResponse(content={"success": False, "error": "No sourceMessageId provided"}, status_code=400)

        existing = await db.execute(select(SettingsDb).where(SettingsDb.job_id == request.sourceMessageId))
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            LOGGER.warning(f"No settings record found for job_id {request.sourceMessageId}")
            return JSONResponse(content={"success": True, "message": "No record to update"})

        stripped_domain = existing_record.domain
        LOGGER.info(f"Found domain: {stripped_domain} for job_id: {request.sourceMessageId}")

        if 200 <= request.status < 300:
            LOGGER.info(f"Reindex completed successfully for domain {stripped_domain}")
            existing_record.job_id = None
            existing_record.last_reindex_time = datetime.utcnow()
            background_tasks.add_task(revalidate_domain, stripped_domain)
        else:
            LOGGER.error(f"Reindex failed for domain {stripped_domain} with status {request.status}")
            existing_record.job_id = None

        await db.commit()

        return JSONResponse(content={"success": True, "domain": stripped_domain, "status": request.status})

    except Exception as e:
        LOGGER.exception(f"Error handling reindex callback: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)


def get_token_from_auth_header(auth_header: str) -> str | None:
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def revalidate_domain(domain: str) -> None:
    LOGGER.info(f"Revalidating domain {domain}")
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            await client.get(f"https://{domain}/api/fern-docs/revalidate")
            LOGGER.info(f"Revalidate request completed for {domain}")
        except Exception as e:
            LOGGER.warning(f"Revalidate request failed for {domain}: {e}")
