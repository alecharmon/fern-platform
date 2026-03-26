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
from fai.credits.client import get_credit_client
from fai.credits.config import is_credit_gated
from fai.dependencies import (
    get_db,
    is_basepath_aware,
    parse_domain_and_basepath,
    resolve_domain_metadata,
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
    get_last_completed_reindex_time,
    has_completed_reindex,
    set_sqs_message_id,
    update_job_status,
)


async def _backfill_org_name_if_missing(record: SettingsDb, db: AsyncSession) -> None:
    """If a settings record has no org_name, try to resolve it from FDR and update the record."""
    if record.org_name:
        return
    try:
        meta = await resolve_domain_metadata(record.domain)
        if meta.org_id:
            record.org_name = meta.org_id
            await db.commit()
            LOGGER.info(f"Backfilled org_name={meta.org_id} for domain {record.domain}, basepath={record.basepath}")
    except Exception as e:
        LOGGER.warning(f"Failed to backfill org_name for domain {record.domain}: {e}")


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

        # If a basepath was parsed from the URL, check upstash to verify the domain
        # is actually basepath-aware. If not, strip the basepath to prevent spurious
        # auto-provisioning of separate settings records for non-basepath-aware domains.
        if basepath:
            if not await is_basepath_aware(stripped_domain):
                LOGGER.info(
                    f"Domain {stripped_domain} is not basepath-aware, ignoring parsed basepath={basepath}"
                )
                basepath = ""

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            try:
                meta = await resolve_domain_metadata(stripped_domain)

                if meta.is_preview:
                    LOGGER.info(f"Skipping auto-provision for preview domain {stripped_domain}")
                    return GetSettingsResponse(ask_ai_enabled=False)

                new_record = SettingsDb(
                    domain=stripped_domain,
                    basepath=basepath,
                    org_name=meta.org_id,
                    last_reindex_time=None,
                    docs_enabled=True,
                )
                db.add(new_record)
                await db.commit()
                await db.refresh(new_record)
                existing_record = new_record
                LOGGER.info(f"Auto-provisioned AI settings for domain {stripped_domain}, basepath={basepath}")

                reindex_queued = False
                try:
                    job_id = await queue_reindex_sqs(stripped_domain, db=db, basepath=basepath)
                    reindex_queued = True
                    LOGGER.info(
                        f"Auto-triggered reindex for domain {stripped_domain}, basepath={basepath}, job_id: {job_id}"
                    )
                except Exception as reindex_err:
                    sentry_sdk.capture_exception(reindex_err)
                    LOGGER.error(f"Failed to auto-trigger reindex for domain {stripped_domain}: {reindex_err}")

                return GetSettingsResponse(
                    ask_ai_enabled=True,
                    is_initially_indexing=reindex_queued,
                    docs_enabled=True,
                    decompose_queries=False,
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                LOGGER.error(f"Failed to auto-provision AI settings for domain {stripped_domain}: {e}")
                return GetSettingsResponse(ask_ai_enabled=False)

        await _backfill_org_name_if_missing(existing_record, db)

        ask_ai_enabled = existing_record.docs_enabled is not False
        has_been_indexed = await has_completed_reindex(db, stripped_domain, basepath)
        is_initially_indexing = ask_ai_enabled and not has_been_indexed

        ask_ai_blocked_reason = None
        if ask_ai_enabled:
            credit_client = get_credit_client()
            if credit_client and existing_record.org_name:
                if is_credit_gated(existing_record.org_name):
                    try:
                        credit_result = await credit_client.check_credits(
                            domain, org_id=existing_record.org_name
                        )
                        if not credit_result.allowed:
                            ask_ai_blocked_reason = "credits_exhausted"
                    except Exception as e:
                        LOGGER.error(f"Credit check failed for {domain}, failing open: {e}")

        return GetSettingsResponse(
            ask_ai_enabled=ask_ai_enabled,
            is_initially_indexing=is_initially_indexing,
            docs_enabled=existing_record.docs_enabled,
            decompose_queries=existing_record.decompose_queries,
            ask_ai_blocked_reason=ask_ai_blocked_reason,
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.exception(f"Error getting docs settings for domain {domain}: {e}")
        return GetSettingsResponse(
            ask_ai_enabled=False,
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
            and existing_record.slack_enabled
            and await has_completed_reindex(db, stripped_domain, basepath)
        )
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=ask_ai_enabled)))
    except Exception:
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False)))


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
            and existing_record.discord_enabled
            and await has_completed_reindex(db, stripped_domain, basepath)
        )

        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=ask_ai_enabled)))
    except Exception:
        return JSONResponse(content=jsonable_encoder(GetSettingsResponse(ask_ai_enabled=False)))


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

    if request.preview:
        LOGGER.info(f"Skipping enable Ask AI for preview domains: {request.domains}")
        return EnableAskAiResponse(success=True)

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

    if preview:
        LOGGER.info(f"Skipping toggle Ask AI for preview domain: {domain}")
        return JSONResponse(
            content=jsonable_encoder(
                ToggleAskAiResponse(success=True, ask_ai_enabled=False)
            )
        )

    try:
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
        existing_record = existing.scalar_one_or_none()

        job_id = None

        if existing_record and existing_record.docs_enabled:
            existing_record.docs_enabled = False
            existing_record.slack_enabled = False
            existing_record.discord_enabled = False
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

        return JSONResponse(
            content=jsonable_encoder(
                ToggleAskAiResponse(success=True, job_id=job_id, ask_ai_enabled=existing_record.docs_enabled)
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
        stripped_domain, parsed_basepath = parse_domain_and_basepath(domain)

        # Use the explicit basepath param if provided; otherwise fall back to
        # whatever was parsed out of the domain URL (consistent with other endpoints).
        if not basepath:
            basepath = parsed_basepath

        # If a basepath is present, check upstash to verify the domain is actually
        # basepath-aware. If not, strip the basepath to prevent spurious reindex jobs.
        if basepath:
            if not await is_basepath_aware(stripped_domain):
                LOGGER.info(
                    f"Domain {stripped_domain} is not basepath-aware, ignoring basepath={basepath} for reindex"
                )
                basepath = ""

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
                    last_reindex_time=None,
                    docs_enabled=True,
                )
                db.add(new_record)
                await db.commit()
                await db.refresh(new_record)
                existing_record = new_record
                LOGGER.info(
                    f"Auto-provisioned AI settings for reindex on domain {stripped_domain}, basepath={basepath}"
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                LOGGER.error(f"Failed to auto-provision settings for reindex on domain {stripped_domain}: {e}")
                # Default to True: docs_enabled is True unless explicitly disabled,
                # and we couldn't find a record that says otherwise.
                return ToggleAskAiResponse(success=False, ask_ai_enabled=True)

        await _backfill_org_name_if_missing(existing_record, db)

        try:
            LOGGER.info(
                f"Queuing reindex SQS with domain={domain}, basepath={basepath}, stripped_domain={stripped_domain}"
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
            return ToggleAskAiResponse(success=False, ask_ai_enabled=existing_record.docs_enabled is not False)

        LOGGER.info(f"Started manual reindex for {domain}, job_id: {job_id}, force_full: {force_full_reindex}")

        return ToggleAskAiResponse(
            success=True,
            job_id=job_id,
            ask_ai_enabled=existing_record.docs_enabled is not False,
        )

    except Exception as e:
        sentry_sdk.capture_exception(
            e,
            extras={"domain": domain, "operation": "reindex_ask_ai"},
        )
        LOGGER.exception("Failed to start manual reindex")
        # Default to True: infrastructure failures shouldn't flip the enabled state.
        return ToggleAskAiResponse(success=False, ask_ai_enabled=True)


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
    """Check whether AI is enabled for a domain.

    AI is considered enabled if `docs_enabled` is True (the default) and
    has not been explicitly disabled. The `status` field is kept for
    backwards compatibility.
    """
    try:
        stripped_domain, basepath = parse_domain_and_basepath(domain)

        # If a basepath was parsed, check upstash to verify the domain is actually
        # basepath-aware. If not, strip the basepath for consistent lookups.
        if basepath:
            if not await is_basepath_aware(stripped_domain):
                LOGGER.info(
                    f"Domain {stripped_domain} is not basepath-aware, ignoring parsed basepath={basepath}"
                )
                basepath = ""

        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await db.execute(query)
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            # No record means AI has never been explicitly disabled — default enabled
            return ToggleStatusResponse(status="completed", ask_ai_enabled=True, last_reindex_time=None)

        ask_ai_enabled = existing_record.docs_enabled is not False
        last_completed = await get_last_completed_reindex_time(db, stripped_domain, basepath)
        last_reindex = last_completed.isoformat() if last_completed else None

        return ToggleStatusResponse(
            status="completed",
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
    deprecated=True,
)
async def set_job_id(
    domain: str,
    job_id: str,
) -> SetJobIdResponse:
    """Deprecated no-op. Job tracking now uses /reindexing/jobs endpoints only."""
    LOGGER.warning(f"Deprecated endpoint set-job-id called for domain={domain}, job_id={job_id} — this is now a no-op")
    stripped_domain, _ = parse_domain_and_basepath(domain)
    return SetJobIdResponse(success=True, domain=stripped_domain, job_id=job_id)


@fai_app.post(
    "/settings/ask-ai/reindex-callback",
    openapi_extra={"x-fern-audiences": ["internal"]},
    deprecated=True,
)
async def reindex_callback(
    request: ReindexCallbackRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Handle callback from SQS reindexing worker when reindex completes.

    Deprecated: the TS worker now updates job status via /reindexing/jobs endpoints.
    This endpoint is kept for backwards compatibility and still updates
    last_reindex_time on the settings record so existing consumers work.
    """
    try:
        LOGGER.warning(
            f"Deprecated reindex-callback called - status: {request.status}, "
            f"messageId: {request.sourceMessageId}, jobId: {request.jobId}"
        )

        callback_domain = strip_domain(request.domain)

        # Look up settings record by domain
        existing = await db.execute(select(SettingsDb).where(SettingsDb.domain == callback_domain))
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            LOGGER.warning(f"No settings record found for domain {callback_domain}")
            return JSONResponse(content={"success": True, "message": "No record to update"})

        if request.status == "success":
            LOGGER.info(f"Reindex completed successfully for domain {existing_record.domain}")
            was_first_reindex = existing_record.last_reindex_time is None
            existing_record.last_reindex_time = datetime.utcnow()

            if was_first_reindex:
                background_tasks.add_task(revalidate_domain, existing_record.domain)
        else:
            LOGGER.error(f"Reindex failed for domain {existing_record.domain}")

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
