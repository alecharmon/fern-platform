import hashlib
import hmac
import json
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

from src.fai.app import fai_app
from src.fai.db import async_session_maker
from src.fai.models.db.slack_integration_db import SlackIntegrationDb
from src.fai.models.db.slack_message_cache_db import SlackMessageCacheDb
from src.fai.models.types.slack_integration_types import (
    CreateSlackIntegration,
    SlackIntegrationResponse,
)
from src.fai.utils.slack.client import (
    add_reaction,
    remove_reaction,
    send_error_message,
    send_slack_message,
)
from src.fai.utils.slack.message_handler import (
    get_slack_integration,
    handle_slack_message,
)
from src.settings import (
    LOGGER,
    VARIABLES,
)

MESSAGE_CACHE_TTL = 30


async def cleanup_message_cache() -> None:
    cutoff_time = datetime.now(UTC) - timedelta(seconds=MESSAGE_CACHE_TTL)

    async with async_session_maker() as session:
        await session.execute(delete(SlackMessageCacheDb).where(SlackMessageCacheDb.processed_at < cutoff_time))
        await session.commit()


async def is_message_processed(team_id: str, message_ts: str) -> bool:
    async with async_session_maker() as session:
        result = await session.execute(
            select(SlackMessageCacheDb).where(
                SlackMessageCacheDb.team_id == team_id, SlackMessageCacheDb.message_ts == message_ts
            )
        )
        return result.scalar_one_or_none() is not None


async def mark_message_processed(team_id: str, message_ts: str) -> None:
    async with async_session_maker() as session:
        stmt = insert(SlackMessageCacheDb).values(
            id=str(uuid4()), message_ts=message_ts, team_id=team_id, processed_at=datetime.now(UTC)
        )
        stmt = stmt.on_conflict_do_nothing(constraint="uq_slack_message_cache_team_message")
        await session.execute(stmt)
        await session.commit()


def verify_slack_signature(request_body: bytes, timestamp: str, signature: str) -> bool:
    if not VARIABLES.SLACK_SIGNING_SECRET:
        LOGGER.warning("SLACK_SIGNING_SECRET not configured, skipping verification")
        return True

    if abs(time.time() - float(timestamp)) > 60 * 5:
        return False

    sig_basestring = f"v0:{timestamp}:{request_body.decode('utf-8')}"

    my_signature = (
        "v0=" + hmac.new(VARIABLES.SLACK_SIGNING_SECRET.encode(), sig_basestring.encode(), hashlib.sha256).hexdigest()
    )

    return hmac.compare_digest(my_signature, signature)


async def get_domain_from_slack_team(team_id: str) -> str | None:
    async with async_session_maker() as session:
        result = await session.execute(select(SlackIntegrationDb).where(SlackIntegrationDb.slack_team_id == team_id))
        integration = result.scalar_one_or_none()
        return integration.domain if integration else None


@fai_app.post("/slack/integrations", openapi_extra={"x-fern-audiences": ["internal"]})
async def create_slack_integration(integration_request: CreateSlackIntegration) -> SlackIntegrationResponse:
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(SlackIntegrationDb).where(SlackIntegrationDb.domain == integration_request.domain)
            )
            existing = result.scalar_one_or_none()

            if existing:
                return SlackIntegrationResponse(
                    integration_id=existing.integration_id,
                    domain=existing.domain,
                    slack_team_id=existing.slack_team_id,
                    slack_team_name=existing.slack_team_name,
                    created_at=existing.created_at,
                    installed_at=existing.installed_at,
                )

            new_integration = SlackIntegrationDb(domain=integration_request.domain, created_at=datetime.now(UTC))
            session.add(new_integration)
            await session.commit()
            await session.refresh(new_integration)

            return SlackIntegrationResponse(
                integration_id=new_integration.integration_id,
                domain=new_integration.domain,
                slack_team_id=new_integration.slack_team_id,
                slack_team_name=new_integration.slack_team_name,
                created_at=new_integration.created_at,
                installed_at=new_integration.installed_at,
            )

    except Exception as e:
        LOGGER.error(f"Error creating Slack integration: {e}")
        raise HTTPException(status_code=500, detail="Failed to create integration")


@fai_app.post("/slack/events", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_slack_events(request: Request) -> JSONResponse:
    try:
        body = await request.json()

        if body.get("type") == "url_verification":
            challenge = body.get("challenge")
            if challenge:
                LOGGER.info("Slack URL verification challenge received")
                return JSONResponse(content={"challenge": challenge})
            else:
                raise HTTPException(status_code=400, detail="Missing challenge in URL verification")

        if body.get("type") == "event_callback":
            event = body.get("event", {})
            event_type = event.get("type")
            team_id = body.get("team_id")

            if not team_id:
                LOGGER.error("Missing team_id in event")
                return JSONResponse(content={"status": "error", "message": "Missing team_id"}, status_code=400)

            LOGGER.info(f"Received Slack event: {event_type} from team: {team_id}")

            await cleanup_message_cache()

            message_ts = event.get("ts")
            if message_ts:
                if await is_message_processed(team_id, message_ts):
                    LOGGER.info(f"Skipping duplicate message: {message_ts}")
                    return JSONResponse(content={"status": "ok"})

            if event_type == "app_mention":
                if message_ts:
                    await mark_message_processed(team_id, message_ts)
                await handle_app_mention(event, team_id)
            elif event_type == "message":
                channel_type = event.get("channel_type")
                if channel_type == "im":
                    if message_ts:
                        await mark_message_processed(team_id, message_ts)
                    await handle_message(event, team_id)
                else:
                    LOGGER.info("Skipping channel message without app mention")
            else:
                LOGGER.info(f"Unhandled event type: {event_type}")

            return JSONResponse(content={"status": "ok"})

        LOGGER.warning(f"Unknown Slack request type: {body.get('type')}")
        return JSONResponse(content={"status": "ok"})

    except Exception as e:
        LOGGER.error(f"Error handling Slack event: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@fai_app.post("/slack/slash-commands", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_slack_slash_commands(request: Request) -> JSONResponse:
    try:
        form_data = await request.form()
        command_data = dict(form_data)

        command = command_data.get("command")
        text = command_data.get("text", "")
        user_id = command_data.get("user_id")
        command_data.get("channel_id")

        LOGGER.info(f"Received Slack slash command: {command} from user {user_id}")

        response_text = f"Received command: {command}"
        if text:
            response_text += f" with arguments: {text}"

        return JSONResponse(
            content={
                "response_type": "in_channel",
                "text": response_text,
            }
        )

    except Exception as e:
        LOGGER.error(f"Error handling Slack slash command: {e}")
        return JSONResponse(
            content={"text": "Sorry, an error occurred processing your command."},
            status_code=200,
        )


@fai_app.post("/slack/interactions", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_slack_interactions(request: Request) -> JSONResponse:
    try:
        form_data = await request.form()
        payload_str = form_data.get("payload")

        if not payload_str:
            raise HTTPException(status_code=400, detail="Missing payload")

        payload = json.loads(payload_str)

        interaction_type = payload.get("type")
        user = payload.get("user", {})

        LOGGER.info(f"Received Slack interaction: {interaction_type} from user {user.get('id')}")

        if interaction_type == "block_actions":
            actions = payload.get("actions", [])
            for action in actions:
                action_id = action.get("action_id")
                LOGGER.info(f"Processing action: {action_id}")

        elif interaction_type == "view_submission":
            view = payload.get("view", {})
            LOGGER.info(f"Processing view submission: {view.get('callback_id')}")

        return JSONResponse(content={"status": "ok"})

    except Exception as e:
        LOGGER.error(f"Error handling Slack interaction: {e}")
        return JSONResponse(
            content={"text": "Sorry, an error occurred processing your interaction."},
            status_code=200,
        )


async def handle_app_mention(event: dict[str, Any], team_id: str) -> None:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel")
    message_ts = event.get("ts")

    LOGGER.info(f"App mentioned by {user} in {channel}: {text}")

    integration = await get_slack_integration(team_id)
    if integration and integration.slack_bot_token and message_ts and channel:
        await add_reaction(channel, message_ts, "eyes", integration.slack_bot_token)

    response = await handle_slack_message(event, team_id, is_app_mention=True)

    if not response.response_text or not response.bot_token:
        LOGGER.error("Could not generate response or missing bot token")
        return

    success = await send_slack_message(response.channel, response.response_text, response.bot_token, response.thread_ts)

    if integration and integration.slack_bot_token and message_ts and channel:
        await remove_reaction(channel, message_ts, "eyes", integration.slack_bot_token)
        await add_reaction(channel, message_ts, "outbox_tray", integration.slack_bot_token)

    if not success:
        await send_error_message(response.channel, response.bot_token, response.thread_ts)


async def handle_message(event: dict[str, Any], team_id: str) -> None:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel")
    message_ts = event.get("ts")

    LOGGER.info(f"Message from {user} in {channel}: {text}")

    integration = await get_slack_integration(team_id)
    if integration and integration.slack_bot_token and message_ts and channel:
        await add_reaction(channel, message_ts, "eyes", integration.slack_bot_token)

    response = await handle_slack_message(event, team_id, is_app_mention=False)

    if not response.response_text or not response.bot_token:
        LOGGER.error("Could not generate response or missing bot token")
        return

    success = await send_slack_message(response.channel, response.response_text, response.bot_token, response.thread_ts)

    if integration and integration.slack_bot_token and message_ts and channel:
        await remove_reaction(channel, message_ts, "eyes", integration.slack_bot_token)
        await add_reaction(channel, message_ts, "outbox_tray", integration.slack_bot_token)

    if not success:
        await send_error_message(response.channel, response.bot_token, response.thread_ts)


@fai_app.get("/slack/oauth/callback", openapi_extra={"x-fern-audiences": ["internal"]})
async def handle_slack_oauth_callback(code: str, state: str | None = None) -> JSONResponse:
    try:
        LOGGER.info(f"Received OAuth callback with code: {code[:10]}... and state: {state}")

        if not state:
            raise HTTPException(status_code=400, detail="Missing integration_id in state parameter")

        async with async_session_maker() as session:
            result = await session.execute(select(SlackIntegrationDb).where(SlackIntegrationDb.integration_id == state))
            integration = result.scalar_one_or_none()

            if not integration:
                raise HTTPException(status_code=404, detail="Invalid integration_id")

            if not VARIABLES.SLACK_CLIENT_ID or not VARIABLES.SLACK_CLIENT_SECRET:
                LOGGER.error("Slack OAuth credentials not configured")
                raise HTTPException(status_code=500, detail="OAuth not configured")

            client = AsyncWebClient()
            oauth_response = await client.oauth_v2_access(
                client_id=VARIABLES.SLACK_CLIENT_ID, client_secret=VARIABLES.SLACK_CLIENT_SECRET, code=code
            )

            if not oauth_response.get("ok"):
                LOGGER.error(f"OAuth exchange error: {oauth_response.get('error')}")
                raise HTTPException(status_code=500, detail=oauth_response.get("error", "OAuth failed"))

            team_id = oauth_response.get("team", {}).get("id")

            if team_id:
                existing_team_result = await session.execute(
                    select(SlackIntegrationDb).where(
                        SlackIntegrationDb.slack_team_id == team_id, SlackIntegrationDb.integration_id != state
                    )
                )
                existing_team_integration = existing_team_result.scalar_one_or_none()

                if existing_team_integration:
                    LOGGER.info(
                        f"Removing team {team_id} from old integration {existing_team_integration.integration_id}"
                    )
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

            LOGGER.info(f"Successfully installed Slack app for team: {integration.slack_team_id}")

        return JSONResponse(
            content={
                "status": "success",
                "message": "Slack app successfully installed",
                "team_id": integration.slack_team_id,
                "domain": integration.domain,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.error(f"Error handling Slack OAuth callback: {e}")
        raise HTTPException(status_code=500, detail="OAuth callback failed")


@fai_app.get("/slack/get-install", openapi_extra={"x-fern-audiences": ["internal"]})
async def get_slack_install_link(domain: str) -> JSONResponse:
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(SlackIntegrationDb).where(SlackIntegrationDb.domain == domain).limit(1)
            )
            integration = result.scalar_one_or_none()

            if integration:
                integration_id = integration.integration_id
                LOGGER.info(f"Using existing integration {integration_id} for domain {domain}")
            else:
                from uuid import uuid4

                integration_id = str(uuid4())
                new_integration = SlackIntegrationDb(
                    integration_id=integration_id,
                    domain=domain,
                )
                session.add(new_integration)
                await session.commit()
                LOGGER.info(f"Created new integration {integration_id} for domain {domain}")

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
        ]

        scope_string = ",".join(scopes)

        install_url = (
            f"https://slack.com/oauth/v2/authorize?"
            f"client_id={VARIABLES.SLACK_CLIENT_ID}&"
            f"scope={quote(scope_string)}&"
            f"state={integration_id}"
        )

        return JSONResponse(
            content={
                "integration_id": integration_id,
                "domain": domain,
                "install_url": install_url,
                "scopes": scopes,
            }
        )

    except Exception as e:
        LOGGER.error(f"Error generating Slack install link: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate install link")
