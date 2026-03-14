import json
import os
from datetime import datetime
from typing import Literal

import aioboto3
import httpx
import sentry_sdk
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
    parse_domain_and_basepath,
    resolve_org_id,
    strip_domain,
    verify_token,
)
from fai.models.api.settings_api import (
    EnableAskAiRequest,
    EnableAskAiResponse,
    GetSettingsResponse,
    SetJobIdResponse,
    ToggleAskAiResponse,
    ToggleStatusResponse,
)
from fai.models.db.settings_db import SettingsDb
from fai.models.enums.reindexing_enums import ReindexingJobStatus
from fai.models.types.reindex_callback_request_type import ReindexCallbackRequest
from fai.settings import LOGGER
from fai.utils.reindexing.reindexing_job_operations import (
    create_job,
    set_sqs_message_id,
    update_job_status,
)


async def queue_reindex_sqs(
    domain: str,
    db: AsyncSession,
    basepath: str = "",
    force_full_reindex: bool = False,
) -> str:
    """Create a reindexing job row, send an SQS message, and return the job ID.

    Returns the job ID (not the SQS message ID).
    """
    queue_url = os.environ.get("FAI_REINDEXING_SQS_URL")

    if not queue_url:
        raise ValueError("FAI_REINDEXING_SQS_URL environment variable not configured")

    # Step 1: Create the job row in the DB with status=queued
    job = await create_job(
        db=db,
        domain=domain,
        basepath=basepath,
        force_full_reindex=force_full_reindex,
    )
    job_id = job.id

    # Step 2: Send SQS message with job_id in the body
    session = aioboto3.Session()
    message_body: dict[str, str | bool] = {
        "domain": domain,
        "basepath": basepath,
        "forceFullReindex": force_full_reindex,
        "jobId": job_id,
    }

    try:
        async with session.client("sqs", region_name="us-east-1") as sqs:
            response = await sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message_body))
            sqs_message_id = response["MessageId"]

            # Step 3: Update the job row with the SQS message ID
            await set_sqs_message_id(db=db, job_id=job_id, sqs_message_id=sqs_message_id)

            sentry_sdk.add_breadcrumb(
                category="reindex",
                message=f"Queued reindex job for {domain}",
                level="info",
                data={
                    "domain": domain,
                    "basepath": basepath,
                    "job_id": job_id,
                    "sqs_message_id": sqs_message_id,
                    "force_full_reindex": force_full_reindex,
                },
            )
            LOGGER.info(
                f"Queued reindex for {domain}, basepath={basepath}, "
                f"jobId: {job_id}, sqsMessageId: {sqs_message_id}, "
                f"forceFullReindex: {force_full_reindex}"
            )
            return job_id
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.error(f"Failed to send SQS message for job {job_id}: {e}")
        try:
            await update_job_status(
                db=db,
                job_id=job_id,
                status=ReindexingJobStatus.FAILED,
                error=f"Failed to send SQS message: {e}",
            )
        except Exception as status_err:
            LOGGER.error(f"Failed to mark job {job_id} as failed: {status_err}")
        raise


@fai_app.get(
    "/settings/ask-ai/docs",
    response_model=GetSettingsResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def get_docs_settings(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> GetSettingsResponse:
    """Get settings for a domain and organization.

    Auto-provisions a new settings record and triggers reindex if no record exists.
    Returns ask_ai_enabled=True by default unless the user has explicitly disabled docs.
    """
    try:
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            try:
                org_id = await resolve_org_id(stripped_domain)
                new_record = SettingsDb(
                    domain=stripped_domain,
                    basepath=basepath,
                    org_name=org_id,
                    job_id=None,
                    last_reindex_time=None,
                    docs_enabled=True,
                )
                db.add(new_record)
                await db.commit()
                await db.refresh(new_record)
                existing_record = new_record
                LOGGER.info(f"Auto-provisioned AI settings for domain {stripped_domain}, basepath={basepath}")

                try:
                    job_id = await queue_reindex_sqs(stripped_domain, db=db, basepath=basepath)
                    LOGGER.info(
                        f"Auto-triggered reindex for domain {stripped_domain}, "
                        f"basepath={basepath}, job_id: {job_id}"
                    )
                except Exception as reindex_err:
                    sentry_sdk.capture_exception(reindex_err)
                    LOGGER.error(f"Failed to auto-trigger reindex for domain {stripped_domain}: {reindex_err}")
                    job_id = None

                return GetSettingsResponse(
                    ask_ai_enabled=True,
                    job_id=job_id,
                    is_initially_indexing=True,
                    docs_enabled=True,
                    decompose_queries=False,
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                LOGGER.error(f"Failed to auto-provision AI settings for domain {stripped_domain}: {e}")
                return GetSettingsResponse(ask_ai_enabled=False, job_id=None)

        ask_ai_enabled = existing_record.docs_enabled is not False
        job_id = existing_record.job_id
        is_initially_indexing = existing_record.docs_enabled is not False and existing_record.last_reindex_time is None

        return GetSettingsResponse(
            ask_ai_enabled=ask_ai_enabled,
            job_id=job_id,
            is_initially_indexing=is_initially_indexing,
            docs_enabled=existing_record.docs_enabled,
            decompose_queries=existing_record.decompose_queries,
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.exception(f"Error getting docs settings for domain {domain}: {e}")
        return GetSettingsResponse(
            ask_ai_enabled=False,
            job_id=None,
        )


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
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
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
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
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
            stripped_domain, basepath = parse_domain_and_basepath(domain)

            if not docs_enabled and not slack_enabled and not discord_enabled:
                LOGGER.warning(f"Skipping domain {domain}: no locations specified for enablement")
                results.append({"domain": domain, "success": False})
                continue

            query = select(SettingsDb).where(
                SettingsDb.domain == stripped_domain,
                SettingsDb.basepath == basepath,
            )
            existing = await db.execute(query)
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
                    basepath=basepath,
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
            try:
                job_id = await queue_reindex_sqs(stripped_domain, db=db, basepath=basepath)
                LOGGER.info(f"Successfully queued reindex for domain {stripped_domain}, job_id: {job_id}")
                results.append({"domain": domain, "success": True, "job_id": job_id})
            except Exception as e:
                sentry_sdk.capture_exception(
                    e,
                    extras={"domain": stripped_domain, "operation": "queue_reindex"},
                )
                LOGGER.error(f"Failed to queue reindex for domain {stripped_domain}: {e}")
                results.append({"domain": domain, "success": False})

        except Exception as e:
            sentry_sdk.capture_exception(
                e,
                extras={"domain": domain, "operation": "enable_ask_ai"},
            )
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
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
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
                job_id = await queue_reindex_sqs(stripped_domain, db=db, basepath=basepath)
                LOGGER.info(f"Successfully queued reindex for domain {stripped_domain}, job_id: {job_id}")
            except Exception as e:
                sentry_sdk.capture_exception(
                    e,
                    extras={"domain": stripped_domain, "operation": "queue_reindex"},
                )
                LOGGER.error(f"Failed to queue reindex for domain {stripped_domain}: {e}")
                return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))

            if existing_record:
                if locations is not None:
                    existing_record.docs_enabled = "docs" in locations
                    existing_record.slack_enabled = "slack" in locations
                    existing_record.discord_enabled = "discord" in locations
                await db.commit()
                LOGGER.info(f"Updated existing record for domain {stripped_domain}")
            else:
                new_docs_enabled = True
                new_slack_enabled = True
                new_discord_enabled = True
                if locations is not None:
                    new_docs_enabled = "docs" in locations
                    new_slack_enabled = "slack" in locations
                    new_discord_enabled = "discord" in locations

                new_record = SettingsDb(
                    domain=stripped_domain,
                    basepath=basepath,
                    org_name=org_name,
                    job_id=None,
                    last_reindex_time=None,
                    is_preview=preview,
                    docs_enabled=new_docs_enabled,
                    slack_enabled=new_slack_enabled,
                    discord_enabled=new_discord_enabled,
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

    except Exception as e:
        sentry_sdk.capture_exception(
            e,
            extras={"domain": domain, "operation": "toggle_ask_ai"},
        )
        LOGGER.exception("Failed to toggle Ask AI")
        return JSONResponse(content=jsonable_encoder(ToggleAskAiResponse(success=False, ask_ai_enabled=False)))


@fai_app.post(
    "/settings/ask-ai/reindex",
    response_model=ToggleAskAiResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def reindex_ask_ai(
    domain: str,
    org_name: str | None = None,
    force_full_reindex: bool = False,
    basepath: str = "",
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> ToggleAskAiResponse:
    """Trigger reindex for a domain, auto-provisioning settings if needed.

    Args:
        domain: Domain to reindex
        org_name: Organization name (used when auto-provisioning a new record)
        force_full_reindex: If True, deletes all existing data and performs a fresh full index
    """
    try:
        stripped_domain = strip_domain(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            try:
                resolved_org = org_name or await resolve_org_id(stripped_domain)
                new_record = SettingsDb(
                    domain=stripped_domain,
                    basepath=basepath,
                    org_name=resolved_org,
                    job_id=None,
                    last_reindex_time=None,
                    docs_enabled=True,
                )
                db.add(new_record)
                await db.commit()
                await db.refresh(new_record)
                existing_record = new_record
                LOGGER.info(
                    f"Auto-provisioned AI settings for reindex on domain {stripped_domain}, "
                    f"basepath={basepath}"
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                LOGGER.error(f"Failed to auto-provision settings for reindex on domain {stripped_domain}: {e}")
                return ToggleAskAiResponse(success=False, ask_ai_enabled=False)

        if existing_record.job_id is not None:
            return ToggleAskAiResponse(
                success=True,
                job_id=existing_record.job_id,
                ask_ai_enabled=existing_record.last_reindex_time is not None,
            )

        try:
            LOGGER.info(
                f"Queuing reindex SQS with domain={domain}, "
                f"basepath={basepath}, stripped_domain={stripped_domain}"
            )
            job_id = await queue_reindex_sqs(
                stripped_domain, db=db, basepath=basepath, force_full_reindex=force_full_reindex
            )
        except Exception as e:
            sentry_sdk.capture_exception(
                e,
                extras={
                    "domain": stripped_domain,
                    "basepath": basepath,
                    "force_full_reindex": force_full_reindex,
                    "operation": "queue_reindex",
                },
            )
            LOGGER.error(f"Failed to queue manual reindex for domain {domain}: {e}")
            return ToggleAskAiResponse(success=False, ask_ai_enabled=existing_record.last_reindex_time is not None)

        LOGGER.info(f"Started manual reindex for {domain}, job_id: {job_id}, force_full: {force_full_reindex}")

        return ToggleAskAiResponse(
            success=True,
            job_id=job_id,
            ask_ai_enabled=existing_record.last_reindex_time is not None,
        )

    except Exception as e:
        sentry_sdk.capture_exception(
            e,
            extras={"domain": domain, "operation": "reindex_ask_ai"},
        )
        LOGGER.exception("Failed to start manual reindex")
        return ToggleAskAiResponse(success=False, ask_ai_enabled=False)


@fai_app.get(
    "/settings/ask-ai/toggle/status",
    response_model=ToggleStatusResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def get_toggle_status(
    domain: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_token),
) -> ToggleStatusResponse:
    """Get the status of Ask AI toggle operation."""
    try:
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            return ToggleStatusResponse(status="failed", ask_ai_enabled=False, last_reindex_time=None)

        ask_ai_enabled = existing_record.last_reindex_time is not None

        last_reindex = existing_record.last_reindex_time.isoformat() if existing_record.last_reindex_time else None

        if not existing_record.job_id:
            return ToggleStatusResponse(
                status="completed",
                ask_ai_enabled=ask_ai_enabled,
                last_reindex_time=last_reindex,
            )
        else:
            return ToggleStatusResponse(
                status="in_progress",
                ask_ai_enabled=ask_ai_enabled,
                last_reindex_time=last_reindex,
            )

    except Exception:
        LOGGER.exception("Failed to get toggle status")
        return JSONResponse(
            content=jsonable_encoder(
                ToggleStatusResponse(status="failed", ask_ai_enabled=False, last_reindex_time=None)
            )
        )


@fai_app.post(
    "/settings/ask-ai/set-job-id",
    response_model=SetJobIdResponse,
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def set_job_id(
    domain: str,
    job_id: str,
    db: AsyncSession = Depends(get_db),
) -> SetJobIdResponse:
    """Set the job_id for a domain when reindex starts processing."""
    try:
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            LOGGER.warning(f"No settings record found for domain {stripped_domain}")
            return SetJobIdResponse(success=False)

        existing_record.job_id = job_id
        await db.commit()
        LOGGER.info(f"Set job_id {job_id} for domain {stripped_domain}")

        return SetJobIdResponse(success=True, domain=stripped_domain, job_id=job_id)

    except Exception as e:
        LOGGER.exception(f"Error setting job_id: {e}")
        return SetJobIdResponse(success=False)


@fai_app.post(
    "/settings/ask-ai/reindex-callback",
    openapi_extra={"x-fern-audiences": ["internal"]},
)
async def reindex_callback(
    request: ReindexCallbackRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Handle callback from SQS reindexing worker when reindex completes."""
    try:
        LOGGER.info(
            f"Received reindex callback - status: {request.status}, "
            f"messageId: {request.sourceMessageId}, jobId: {request.jobId}"
        )

        callback_domain = strip_domain(request.domain)
        LOGGER.info(f"Reindex callback: raw domain={request.domain}, callback_domain={callback_domain}")

        # Look up settings record by job_id (for backward compat) or domain
        existing = await db.execute(
            select(SettingsDb).where(SettingsDb.job_id == request.sourceMessageId, SettingsDb.domain == callback_domain)
        )
        existing_record = existing.scalar_one_or_none()

        # Also try looking up by the new job_id field if sourceMessageId didn't match
        if not existing_record and request.jobId:
            existing = await db.execute(
                select(SettingsDb).where(SettingsDb.job_id == request.jobId, SettingsDb.domain == callback_domain)
            )
            existing_record = existing.scalar_one_or_none()

        if not existing_record:
            LOGGER.warning(
                f"No settings record found for job_id {request.sourceMessageId} or {request.jobId}"
            )
            return JSONResponse(content={"success": True, "message": "No record to update"})

        if request.status == "success":
            LOGGER.info(f"Reindex completed successfully for domain {existing_record.domain}")
            was_first_reindex = existing_record.last_reindex_time is None
            existing_record.job_id = None
            existing_record.last_reindex_time = datetime.utcnow()

            if was_first_reindex:
                background_tasks.add_task(revalidate_domain, existing_record.domain)
        else:
            LOGGER.error(f"Reindex failed for domain {existing_record.domain}")
            existing_record.job_id = None

        await db.commit()
        return JSONResponse(content={"success": True, "domain": existing_record.domain, "status": request.status})

    except Exception as e:
        sentry_sdk.capture_exception(
            e,
            extras={
                "domain": request.domain,
                "sourceMessageId": request.sourceMessageId,
                "jobId": request.jobId,
                "status": request.status,
                "operation": "reindex_callback",
            },
        )
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
            await client.get(f"https://{domain}/api/fern-docs/revalidate?reindex=false")
            LOGGER.info(f"Revalidate request completed for {domain}")
        except Exception as e:
            LOGGER.warning(f"Revalidate request failed for {domain}: {e}")
