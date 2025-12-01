from typing import Any

from fastapi import (
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import JSONResponse
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy.ext.asyncio import AsyncSession

from fai.app import fai_app
from fai.dependencies import (
    get_db,
    verify_token,
)
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_message_cache_db import ScribeMessageCacheDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.message_handler import handle_scribe_message
from fai.utils.slack.integration_common import (
    cleanup_message_cache,
    create_integration,
    handle_oauth_callback,
    is_message_processed,
    mark_message_processed,
)


async def cleanup_scribe_message_cache() -> None:
    """Clean up old Scribe message cache entries."""
    await cleanup_message_cache(ScribeMessageCacheDb)


async def is_scribe_message_processed(team_id: str, message_ts: str) -> bool:
    """Check if a Scribe message has already been processed."""
    return await is_message_processed(team_id, message_ts, ScribeMessageCacheDb)


async def mark_scribe_message_processed(team_id: str, message_ts: str) -> None:
    """Mark a Scribe message as processed."""
    await mark_message_processed(team_id, message_ts, ScribeMessageCacheDb, "uq_scribe_message_cache_team_message")


@fai_app.post(
    "/scribe/slack/install", openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]}
)
async def create_scribe_slack_integration(
    domain: str, db: AsyncSession = Depends(get_db), _: None = Depends(verify_token)
) -> JSONResponse:
    result = await create_integration(
        domain=domain,
        db=db,
        integration_db_model=ScribeIntegrationDb,
        client_id=VARIABLES.SCRIBE_SLACK_CLIENT_ID,
        log_prefix="[SCRIBE]",
    )
    # Convert datetime objects to ISO format strings for JSONResponse
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()
    if result.get("installed_at"):
        result["installed_at"] = result["installed_at"].isoformat()
    return JSONResponse(content=result)


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
    return await handle_oauth_callback(
        code=code,
        state=state,
        integration_db_model=ScribeIntegrationDb,
        client_id=VARIABLES.SCRIBE_SLACK_CLIENT_ID,
        client_secret=VARIABLES.SCRIBE_SLACK_CLIENT_SECRET,
        log_prefix="[SCRIBE]",
    )
