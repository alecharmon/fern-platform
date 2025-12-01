import hashlib
import hmac
import time
from datetime import (
    UTC,
    datetime,
    timedelta,
)
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from fastapi import (
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import JSONResponse
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.db import async_session_maker
from fai.dependencies import (
    get_db,
    strip_domain,
    verify_token,
)
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_message_cache_db import ScribeMessageCacheDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.message_handler import handle_scribe_message

MESSAGE_CACHE_TTL = 600


async def cleanup_scribe_message_cache() -> None:
    cutoff_time = datetime.now(UTC) - timedelta(seconds=MESSAGE_CACHE_TTL)

    async with async_session_maker() as session:
        await session.execute(delete(ScribeMessageCacheDb).where(ScribeMessageCacheDb.processed_at < cutoff_time))
        await session.commit()


async def is_scribe_message_processed(team_id: str, message_ts: str) -> bool:
    async with async_session_maker() as session:
        result = await session.execute(
            select(ScribeMessageCacheDb).where(
                ScribeMessageCacheDb.team_id == team_id, ScribeMessageCacheDb.message_ts == message_ts
            )
        )
        return result.scalar_one_or_none() is not None


async def mark_scribe_message_processed(team_id: str, message_ts: str) -> None:
    async with async_session_maker() as session:
        stmt = insert(ScribeMessageCacheDb).values(
            id=str(uuid4()), message_ts=message_ts, team_id=team_id, processed_at=datetime.now(UTC)
        )
        stmt = stmt.on_conflict_do_nothing(constraint="uq_scribe_message_cache_team_message")
        await session.execute(stmt)
        await session.commit()


def verify_scribe_slack_signature(request_body: bytes, timestamp: str, signature: str) -> bool:
    if abs(time.time() - float(timestamp)) > 60 * 5:
        return False

    sig_basestring = f"v0:{timestamp}:{request_body.decode('utf-8')}"

    my_signature = (
        "v0="
        + hmac.new(VARIABLES.SCRIBE_SLACK_SIGNING_SECRET.encode(), sig_basestring.encode(), hashlib.sha256).hexdigest()
    )

    return hmac.compare_digest(my_signature, signature)


def create_scribe_slack_integration_url(integration_id: str) -> str:
    scopes = [
        "app_mentions:read",
        "channels:history",
        "channels:join",
        "channels:read",
        "chat:write",
        "commands",
        "groups:history",
        "im:history",
        "mpim:history",
        "reactions:read",
        "reactions:write",
        "users:read",
        "users:read.email",
    ]
    scope_string = ",".join(scopes)
    return (
        f"https://slack.com/oauth/v2/authorize?"
        f"client_id={VARIABLES.SCRIBE_SLACK_CLIENT_ID}&"
        f"scope={quote(scope_string)}&"
        f"state={integration_id}"
    )


@fai_app.post(
    "/scribe/slack/install", openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]}
)
async def create_scribe_slack_integration(
    domain: str, db: AsyncSession = Depends(get_db), _: None = Depends(verify_token)
) -> JSONResponse:
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(ScribeIntegrationDb).where(ScribeIntegrationDb.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()
        if existing_record:
            integration_url = create_scribe_slack_integration_url(existing_record.integration_id)
            return JSONResponse(
                content={
                    "integration_id": existing_record.integration_id,
                    "domain": existing_record.domain,
                    "slack_team_id": existing_record.slack_team_id,
                    "slack_team_name": existing_record.slack_team_name,
                    "created_at": existing_record.created_at.isoformat() if existing_record.created_at else None,
                    "installed_at": (
                        existing_record.installed_at.isoformat() if existing_record.installed_at else None
                    ),
                    "integration_url": integration_url,
                }
            )

        new_integration = ScribeIntegrationDb(domain=stripped_domain, created_at=datetime.now(UTC))
        db.add(new_integration)
        await db.commit()
        await db.refresh(new_integration)

        integration_url = create_scribe_slack_integration_url(new_integration.integration_id)
        return JSONResponse(
            content={
                "integration_id": new_integration.integration_id,
                "domain": new_integration.domain,
                "slack_team_id": new_integration.slack_team_id,
                "slack_team_name": new_integration.slack_team_name,
                "created_at": new_integration.created_at.isoformat() if new_integration.created_at else None,
                "installed_at": new_integration.installed_at.isoformat() if new_integration.installed_at else None,
                "integration_url": integration_url,
            }
        )

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Failed to create Slack integration: {e}")
        raise HTTPException(status_code=500, detail="Failed to create integration")


@fai_app.post("/scribe/slack/events", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_scribe_slack_events(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    try:
        body = await request.json()

        if body.get("type") == "url_verification":
            challenge = body.get("challenge")
            if challenge:
                LOGGER.info("[SCRIBE] Slack URL verification challenge received")
                return JSONResponse(content={"challenge": challenge})
            else:
                raise HTTPException(status_code=400, detail="Missing challenge in URL verification")

        if body.get("type") == "event_callback":
            event = body.get("event", {})
            event_type = event.get("type")
            team_id = body.get("team_id")

            if not team_id:
                LOGGER.error("[SCRIBE] Missing team_id in event")
                return JSONResponse(content={"status": "error", "message": "Missing team_id"}, status_code=400)

            LOGGER.info(f"[SCRIBE] Received Slack event: {event_type} from team: {team_id}")

            await cleanup_scribe_message_cache()

            message_ts = event.get("ts")
            if message_ts:
                if await is_scribe_message_processed(team_id, message_ts):
                    LOGGER.info(f"[SCRIBE] Skipping duplicate message: {message_ts}")
                    return JSONResponse(content={"status": "ok"})

            if event_type == "app_mention":
                if event.get("bot_id"):
                    LOGGER.info(f"[SCRIBE] Skipping bot message: bot_id={event.get('bot_id')}")
                    return JSONResponse(content={"status": "ok"})

                if message_ts:
                    await mark_scribe_message_processed(team_id, message_ts)

                background_tasks.add_task(handle_app_mention, event, team_id)
            else:
                LOGGER.info(f"[SCRIBE] Ignoring event type: {event_type} (only app_mention supported)")

            return JSONResponse(content={"status": "ok"})

        LOGGER.warning(f"[SCRIBE] Unknown Slack request type: {body.get('type')}")
        return JSONResponse(content={"status": "ok"})

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error handling Slack event: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def handle_app_mention(event: dict[str, Any], team_id: str) -> None:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel")

    LOGGER.info(f"[SCRIBE] App mentioned by {user} in {channel}: {text}")

    response = await handle_scribe_message(event, team_id)

    if not response.response_text or not response.bot_token:
        LOGGER.error("[SCRIBE] Could not generate response or missing bot token")
        return

    client = AsyncWebClient(token=response.bot_token)
    try:
        msg_response = await client.chat_postMessage(
            channel=response.channel,
            text=response.response_text,
            thread_ts=response.thread_ts,
            unfurl_links=False,
            unfurl_media=False,
        )
        if msg_response["ok"]:
            LOGGER.info("[SCRIBE] Successfully sent response to Slack")
        else:
            LOGGER.error(f"[SCRIBE] Failed to send message: {msg_response}")
    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error sending message: {e}")


@fai_app.get("/scribe/slack/oauth/callback", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_scribe_slack_oauth_callback(code: str, state: str | None = None) -> JSONResponse:
    try:
        LOGGER.info(f"[SCRIBE] Received OAuth callback with code: {code[:10]}... and state: {state}")

        if not state:
            raise HTTPException(status_code=400, detail="Missing integration_id in state parameter")

        async with async_session_maker() as session:
            result = await session.execute(
                select(ScribeIntegrationDb).where(ScribeIntegrationDb.integration_id == state)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                raise HTTPException(status_code=404, detail="Invalid integration_id")

            if not VARIABLES.SCRIBE_SLACK_CLIENT_ID or not VARIABLES.SCRIBE_SLACK_CLIENT_SECRET:
                LOGGER.error("[SCRIBE] Slack OAuth credentials not configured")
                raise HTTPException(status_code=500, detail="OAuth not configured")

            client = AsyncWebClient()
            oauth_response = await client.oauth_v2_access(
                client_id=VARIABLES.SCRIBE_SLACK_CLIENT_ID,
                client_secret=VARIABLES.SCRIBE_SLACK_CLIENT_SECRET,
                code=code,
            )

            if not oauth_response.get("ok"):
                LOGGER.error(f"[SCRIBE] OAuth exchange error: {oauth_response.get('error')}")
                raise HTTPException(status_code=500, detail=oauth_response.get("error", "OAuth failed"))

            team_id = oauth_response.get("team", {}).get("id")

            if team_id:
                existing_team_result = await session.execute(
                    select(ScribeIntegrationDb).where(
                        ScribeIntegrationDb.slack_team_id == team_id, ScribeIntegrationDb.integration_id != state
                    )
                )
                existing_team_integration = existing_team_result.scalar_one_or_none()

                if existing_team_integration:
                    old_integration_id = existing_team_integration.integration_id
                    LOGGER.info(f"[SCRIBE] Removing team {team_id} from old integration {old_integration_id}")
                    existing_team_integration.slack_team_id = None
                    existing_team_integration.slack_team_name = None
                    existing_team_integration.slack_bot_token = None
                    existing_team_integration.slack_bot_user_id = None
                    existing_team_integration.slack_app_id = None
                    existing_team_integration.installed_at = None
                    await session.flush()

            integration.slack_team_id = team_id
            integration.slack_team_name = oauth_response.get("team", {}).get("name")
            integration.slack_bot_token = oauth_response.get("access_token")
            integration.slack_bot_user_id = oauth_response.get("bot_user_id")
            integration.slack_app_id = oauth_response.get("app_id")
            integration.installed_at = datetime.now(UTC)

            await session.commit()

            LOGGER.info(f"[SCRIBE] Successfully installed Slack app for team: {integration.slack_team_id}")

        return JSONResponse(
            content={
                "status": "success",
                "message": "Scribe Slack app successfully installed",
                "team_id": integration.slack_team_id,
                "domain": integration.domain,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error handling Slack OAuth callback: {e}")
        raise HTTPException(status_code=500, detail="OAuth callback failed")


@fai_app.get("/scribe/slack/integrations/{domain}", openapi_extra={"x-fern-audiences": ["internal"]})
async def list_scribe_slack_integrations(domain: str) -> JSONResponse:
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(ScribeIntegrationDb)
                .where(ScribeIntegrationDb.domain == domain)
                .order_by(ScribeIntegrationDb.created_at.desc())
            )
            integrations = result.scalars().all()

            integration_list = []
            for integration in integrations:
                integration_list.append(
                    {
                        "integration_id": integration.integration_id,
                        "domain": integration.domain,
                        "slack_team_id": integration.slack_team_id,
                        "slack_team_name": integration.slack_team_name,
                        "created_at": integration.created_at.isoformat() if integration.created_at else None,
                        "installed_at": integration.installed_at.isoformat() if integration.installed_at else None,
                        "is_installed": integration.slack_team_id is not None,
                    }
                )

            return JSONResponse(
                content={
                    "domain": domain,
                    "integrations": integration_list,
                    "total_count": len(integration_list),
                }
            )

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error listing Slack integrations for domain {domain}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list integrations")
