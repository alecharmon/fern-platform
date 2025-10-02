import asyncio
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
from fastapi.responses import (
    JSONResponse,
    Response,
)
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import attributes

from fai.app import fai_app
from fai.db import async_session_maker
from fai.models.api.update_channel_settings import ChannelSettings
from fai.models.db.feedback_db import FeedbackDb
from fai.models.db.slack_integration_db import SlackIntegrationDb
from fai.models.db.slack_message_cache_db import SlackMessageCacheDb
from fai.models.types.slack_integration_types import (
    CreateSlackIntegration,
    SlackIntegrationResponse,
)
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.slack.client import (
    add_reaction,
    open_modal,
    remove_reaction,
    send_ephemeral_message,
    send_error_message,
    update_modal,
)
from fai.utils.slack.message_handler import (
    get_slack_integration,
    get_thread_history,
    handle_slack_message,
    process_message,
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
                if event.get("bot_id"):
                    LOGGER.info(f"Skipping bot message: bot_id={event.get('bot_id')}")
                    return JSONResponse(content={"status": "ok"})

                if message_ts:
                    await mark_message_processed(team_id, message_ts)
                await handle_app_mention(event, team_id)
            elif event_type == "message":
                if event.get("bot_id"):
                    LOGGER.info(f"Skipping bot message: bot_id={event.get('bot_id')}")
                    return JSONResponse(content={"status": "ok"})

                text = event.get("text", "")
                if text:
                    integration = await get_slack_integration(team_id)
                    if integration and integration.slack_bot_user_id:
                        if f"<@{integration.slack_bot_user_id}>" in text:
                            LOGGER.info(
                                "Skipping message event with bot mention (will be handled by app_mention event)"
                            )
                            return JSONResponse(content={"status": "ok"})

                if message_ts:
                    await mark_message_processed(team_id, message_ts)
                await handle_message(event, team_id)
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
        channel_id = command_data.get("channel_id")
        team_id = command_data.get("team_id")

        LOGGER.info(f"Received Slack slash command: {command} from user {user_id}")

        if command in ["/configure", "/configure-dev"]:
            if not team_id or not channel_id or not user_id:
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": "❌ Missing required information. Please try again.",
                    }
                )
            return await handle_configure_command(text, team_id, channel_id, user_id, command)

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

                if action_id in ["feedback_helpful", "feedback_not_helpful"]:
                    return await handle_feedback_button(payload, action)

        elif interaction_type == "view_submission":
            view = payload.get("view", {})
            callback_id = view.get("callback_id")
            LOGGER.info(f"Processing view submission: {callback_id}")

            if callback_id == "feedback_modal":
                return await handle_feedback_submission(payload)

        elif interaction_type == "message_action":
            callback_id = payload.get("callback_id")
            LOGGER.info(f"Processing message action: {callback_id}")

            if callback_id == "draft_ask_fern_reply":
                return await handle_draft_reply_action(payload)

        return JSONResponse(content={"status": "ok"})

    except Exception as e:
        LOGGER.error(f"Error handling Slack interaction: {e}")
        return JSONResponse(
            content={"text": "Sorry, an error occurred processing your interaction."},
            status_code=200,
        )


async def delete_ephemeral_message(response_url: str) -> None:
    try:
        import aiohttp

        payload: dict[str, Any] = {
            "delete_original": True,
        }

        LOGGER.info(f"Deleting ephemeral message with response_url: {response_url[:50]}...")

        async with aiohttp.ClientSession() as session:
            async with session.post(response_url, json=payload) as response:
                if response.status == 200:
                    response_text = await response.text()
                    LOGGER.info(f"Successfully deleted ephemeral message. Response: {response_text[:100]}")
                else:
                    error_text = await response.text()
                    LOGGER.error(f"Failed to delete ephemeral message: {response.status}, Error: {error_text}")
    except Exception as e:
        LOGGER.error(f"Error deleting ephemeral message: {e}")


async def check_feedback_exists(query_id: str, user_id: str) -> bool:
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(FeedbackDb).where(
                    FeedbackDb.query_id == query_id,
                    FeedbackDb.user_email == user_id,
                )
            )
            return result.scalar_one_or_none() is not None
    except Exception as e:
        LOGGER.error(f"Error checking feedback existence: {e}")
        return False


async def handle_feedback_button(payload: dict[str, Any], action: dict[str, Any]) -> JSONResponse:
    try:
        trigger_id = payload.get("trigger_id")
        user = payload.get("user", {})
        user_id = user.get("id")
        team = payload.get("team", {})
        team_id = team.get("id")
        response_url = payload.get("response_url")
        channel = payload.get("channel", {})
        channel_id = channel.get("id")

        value_data = json.loads(action.get("value", "{}"))
        query_id = value_data.get("query_id")
        is_helpful = value_data.get("is_helpful")
        thread_ts = value_data.get("thread_ts")

        if not trigger_id or not query_id:
            LOGGER.error("Missing trigger_id or query_id")
            return JSONResponse(content={"text": "Unable to process feedback"}, status_code=200)

        if await check_feedback_exists(query_id, user_id):
            if response_url:
                await delete_ephemeral_message(response_url)
                integration = await get_slack_integration(team_id)
                if integration and integration.slack_bot_token and channel_id:
                    await send_ephemeral_message(
                        channel=channel_id,
                        user=user_id,
                        text="Thank you for submitting feedback.",
                        bot_token=integration.slack_bot_token,
                        thread_ts=thread_ts,
                    )
            LOGGER.info(f"User {user_id} already provided feedback for query {query_id}")
            return Response(content="", status_code=200)

        integration = await get_slack_integration(team_id)
        if not integration or not integration.slack_bot_token:
            LOGGER.error(f"No integration or bot token found for team {team_id}")
            return JSONResponse(content={"text": "Unable to process feedback"}, status_code=200)

        modal = {
            "type": "modal",
            "callback_id": "feedback_modal",
            "title": {"type": "plain_text", "text": "Provide Feedback"},
            "submit": {"type": "plain_text", "text": "Submit"},
            "close": {"type": "plain_text", "text": "Cancel"},
            "private_metadata": json.dumps(
                {
                    "query_id": query_id,
                    "is_helpful": is_helpful,
                    "team_id": team_id,
                    "user_id": user_id,
                    "response_url": response_url,
                    "channel_id": channel_id,
                    "thread_ts": thread_ts,
                }
            ),
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"You selected: *{'👍 Helpful' if is_helpful else '👎 Not Helpful'}*",
                    },
                },
                {
                    "type": "input",
                    "block_id": "feedback_text",
                    "label": {"type": "plain_text", "text": "Additional feedback (optional)"},
                    "optional": True,
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "feedback_text_input",
                        "multiline": True,
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Tell us more about your experience...",
                        },
                    },
                },
            ],
        }

        view_id = await open_modal(trigger_id, modal, integration.slack_bot_token)
        if not view_id:
            LOGGER.error("Failed to open feedback modal")
            return JSONResponse(content={"text": "Unable to open feedback form"}, status_code=200)

        return Response(content="", status_code=200)

    except Exception as e:
        LOGGER.error(f"Error handling feedback button: {e}")
        return JSONResponse(
            content={"text": "Sorry, an error occurred processing your feedback."},
            status_code=200,
        )


async def handle_feedback_submission(payload: dict[str, Any]) -> JSONResponse:
    try:
        view = payload.get("view", {})
        user = payload.get("user", {})
        user_id = user.get("id")

        private_metadata = json.loads(view.get("private_metadata", "{}"))
        query_id = private_metadata.get("query_id")
        is_helpful = private_metadata.get("is_helpful")
        team_id = private_metadata.get("team_id")
        response_url = private_metadata.get("response_url")
        channel_id = private_metadata.get("channel_id")
        thread_ts = private_metadata.get("thread_ts")

        state = view.get("state", {})
        values = state.get("values", {})
        feedback_text = None
        if "feedback_text" in values:
            feedback_text_input = values["feedback_text"].get("feedback_text_input", {})
            feedback_text = feedback_text_input.get("value")

        domain = await get_domain_from_slack_team(team_id)
        if not domain:
            LOGGER.error(f"No domain found for team {team_id}")
            return JSONResponse(content={"text": "Unable to save feedback"}, status_code=200)

        integration = await get_slack_integration(team_id)
        user_email = user_id

        if integration and integration.slack_bot_token:
            try:
                client = AsyncWebClient(token=integration.slack_bot_token)
                LOGGER.info(f"Fetching user info for user_id: {user_id}")
                user_info = await client.users_info(user=user_id)

                if user_info.get("ok"):
                    user_data = user_info.get("user", {})
                    user_profile = user_data.get("profile", {})

                    email = user_profile.get("email")
                    if email:
                        user_email = email
                        LOGGER.info(f"Successfully retrieved email for user {user_id}: {email}")
                    else:
                        LOGGER.warning(
                            f"No email in profile for user {user_id}. Profile keys: {list(user_profile.keys())}"
                        )

                        if user_data.get("is_bot") is False:
                            email = user_data.get("email")
                            if email:
                                user_email = email
                                LOGGER.info(f"Found email at user level for {user_id}: {email}")
                else:
                    error_msg = user_info.get("error", "Unknown error")
                    LOGGER.error(f"Slack API returned not ok for user {user_id}: {error_msg}")
                    if error_msg == "missing_scope":
                        LOGGER.error("Missing scope to read user email. Ensure 'users:read.email' scope is added.")

            except Exception as e:
                LOGGER.error(f"Exception fetching user email for {user_id}: {str(e)}")

        async with async_session_maker() as session:
            feedback = FeedbackDb(
                id=str(uuid4()),
                query_id=query_id,
                conversation_id=f"slack_{team_id}_{user_id}",
                domain=domain,
                is_helpful=is_helpful,
                feedback_message=feedback_text,
                user_email=user_email,
                created_at=datetime.now(UTC),
            )
            session.add(feedback)
            await session.commit()

        LOGGER.info(
            f"Saved feedback for query {query_id}: helpful={is_helpful}, "
            f"user_email={user_email}, domain={domain}, "
            f"feedback_text={'Yes' if feedback_text else 'No'}"
        )

        if response_url:
            LOGGER.info(f"Replacing ephemeral feedback buttons for user {user_id}")
            await delete_ephemeral_message(response_url)
            if integration and integration.slack_bot_token and channel_id:
                await send_ephemeral_message(
                    channel=channel_id,
                    user=user_id,
                    text="Thank you for submitting feedback.",
                    bot_token=integration.slack_bot_token,
                    thread_ts=thread_ts,
                )
        else:
            LOGGER.warning(f"No response_url available to update ephemeral message for user {user_id}")

        return Response(content="", status_code=200)

    except Exception as e:
        LOGGER.error(f"Error handling feedback submission: {e}")
        return JSONResponse(
            content={
                "response_action": "errors",
                "errors": {"feedback_text": "Sorry, an error occurred saving your feedback. Please try again."},
            },
            status_code=200,
        )


async def send_feedback_ephemeral(
    channel: str,
    user: str,
    bot_token: str,
    query_id: str,
    message_ts: str,
    team_id: str,
    thread_ts: str | None = None,
) -> None:
    try:
        blocks: list[dict[str, Any]] = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Was this response helpful?",
                },
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "👍 Helpful",
                        },
                        "style": "primary",
                        "action_id": "feedback_helpful",
                        "value": json.dumps(
                            {
                                "query_id": query_id,
                                "is_helpful": True,
                                "message_ts": message_ts,
                                "team_id": team_id,
                                "thread_ts": thread_ts,
                            }
                        ),
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "👎 Not Helpful",
                        },
                        "action_id": "feedback_not_helpful",
                        "value": json.dumps(
                            {
                                "query_id": query_id,
                                "is_helpful": False,
                                "message_ts": message_ts,
                                "team_id": team_id,
                                "thread_ts": thread_ts,
                            }
                        ),
                    },
                ],
            },
        ]

        await send_ephemeral_message(
            channel=channel,
            user=user,
            text="Was this response helpful?",
            bot_token=bot_token,
            blocks=blocks,
            thread_ts=thread_ts,
        )
    except Exception as e:
        LOGGER.error(f"Error sending feedback ephemeral message: {e}")


async def check_message_exists(channel: str, message_ts: str, bot_token: str) -> bool:
    try:
        client = AsyncWebClient(token=bot_token)
        if "." in message_ts:
            thread_ts = message_ts.split(".")[0] + "." + message_ts.split(".")[1][:6]
            result = await client.conversations_replies(channel=channel, ts=thread_ts, inclusive=True, limit=100)
            if result["ok"] and "messages" in result:
                return any(msg.get("ts") == message_ts for msg in result["messages"])
        else:
            result = await client.conversations_history(
                channel=channel, latest=message_ts, oldest=message_ts, inclusive=True, limit=1
            )
            if result["ok"] and "messages" in result:
                return len(result["messages"]) > 0 and result["messages"][0].get("ts") == message_ts

        return False
    except Exception as e:
        error_msg = str(e).lower()
        if any(err in error_msg for err in ["thread_not_found", "message_not_found", "not_found"]):
            LOGGER.info(f"Message {message_ts} not found (deleted): {e}")
            return False
        LOGGER.error(f"Error checking if message exists: {e}")
        return True


async def handle_app_mention(event: dict[str, Any], team_id: str) -> None:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel")
    message_ts = event.get("ts")

    LOGGER.info(f"App mentioned by {user} in {channel}: {text}")

    response = await handle_slack_message(event, team_id, is_app_mention=True)

    if not response.response_text or not response.bot_token:
        LOGGER.error("Could not generate response or missing bot token")
        return

    if message_ts and channel and response.bot_token:
        message_exists = await check_message_exists(channel, message_ts, response.bot_token)
        if not message_exists:
            LOGGER.info(f"Original message {message_ts} was deleted, skipping response")
            return

    client = AsyncWebClient(token=response.bot_token)
    success = False
    bot_message_ts = None

    try:
        msg_response = await client.chat_postMessage(
            channel=response.channel,
            text=response.response_text,
            thread_ts=response.thread_ts,
            unfurl_links=False,
            unfurl_media=False,
        )
        success = msg_response["ok"]
        bot_message_ts = msg_response.get("ts") if success else None

        if success and response.user_id and bot_message_ts:
            feedback_thread_ts = response.thread_ts

            if not response.query_id:
                LOGGER.warning(f"No query_id for feedback, but still sending feedback request for message {message_ts}")

            LOGGER.info(
                f"Sending feedback ephemeral - thread_ts: {feedback_thread_ts}, "
                f"bot_message_ts: {bot_message_ts}, channel: {response.channel}, "
                f"original_event_thread_ts: {event.get('thread_ts')}"
            )

            if response.bot_token and message_ts and channel:
                await remove_reaction(channel, message_ts, "eyes", response.bot_token)
                await add_reaction(channel, message_ts, "outbox_tray", response.bot_token)

            await asyncio.sleep(2.5)

            await send_feedback_ephemeral(
                channel=response.channel,
                user=response.user_id,
                bot_token=response.bot_token,
                query_id=response.query_id or "unknown",
                message_ts=bot_message_ts,
                team_id=team_id,
                thread_ts=feedback_thread_ts,
            )

    except Exception as e:
        LOGGER.error(f"Error sending message: {e}")
        success = False
        bot_message_ts = None

    if not success:
        await send_error_message(response.channel, response.bot_token, response.thread_ts)


async def handle_draft_reply_action(payload: dict[str, Any]) -> JSONResponse:
    try:
        trigger_id = payload.get("trigger_id")
        user = payload.get("user", {})
        user.get("id")
        team = payload.get("team", {})
        team_id = team.get("id")
        channel = payload.get("channel", {})
        channel_id = channel.get("id")
        message = payload.get("message", {})
        message_ts = message.get("ts")
        message_text = message.get("text", "")

        LOGGER.info(f"Drafting reply for message: {message_text[:100]}... in channel {channel_id}")

        if not trigger_id:
            LOGGER.error("No trigger_id in payload")
            return JSONResponse(content={"text": "Unable to open modal: missing trigger_id"}, status_code=200)

        integration = await get_slack_integration(team_id)
        if not integration or not integration.slack_bot_token:
            LOGGER.error(f"No integration or bot token found for team {team_id}")
            return JSONResponse(content={"text": "Unable to draft reply: bot not configured"}, status_code=200)

        loading_modal = {
            "type": "modal",
            "callback_id": "draft_reply_modal",
            "title": {"type": "plain_text", "text": "Draft Reply"},
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Original Message:*",
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"> {message_text[:500]}{'...' if len(message_text) > 500 else ''}",
                    },
                },
                {"type": "divider"},
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            ":hourglass_flowing_sand: *Generating your draft reply...*\n\n"
                            "_This may take a few moments._"
                        ),
                    },
                },
            ],
            "close": {"type": "plain_text", "text": "Cancel"},
        }

        view_id = await open_modal(trigger_id, loading_modal, integration.slack_bot_token)

        if not view_id:
            LOGGER.error("Failed to open modal")
            return JSONResponse(content={"text": "Unable to open modal"}, status_code=200)

        asyncio.create_task(
            generate_and_update_modal(
                view_id,
                message_text,
                message_ts,
                message.get("thread_ts"),
                channel_id,
                team_id,
                integration,
            )
        )

        return JSONResponse(content={"status": "ok"})

    except Exception as e:
        LOGGER.error(f"Error handling draft reply action: {e}")
        return JSONResponse(
            content={"text": "Sorry, an error occurred while drafting the reply."},
            status_code=200,
        )


async def generate_and_update_modal(
    view_id: str,
    message_text: str,
    message_ts: str,
    thread_ts: str | None,
    channel_id: str,
    team_id: str,
    integration: Any,
) -> None:
    try:
        actual_thread_ts = thread_ts or message_ts
        message_history = None
        if actual_thread_ts:
            message_history = await get_thread_history(
                channel_id, actual_thread_ts, integration.slack_bot_token, integration.slack_bot_user_id
            )

        conversation_id = f"slack_draft_{team_id}_{channel_id}_{actual_thread_ts}"
        response_text, _ = await process_message(
            message_text,
            integration.domain,
            None,
            message_history,
            conversation_id=conversation_id,
        )

        updated_modal = {
            "type": "modal",
            "callback_id": "draft_reply_modal",
            "title": {"type": "plain_text", "text": "Draft Reply"},
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Original Message:*",
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"> {message_text[:500]}{'...' if len(message_text) > 500 else ''}",
                    },
                },
                {"type": "divider"},
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Draft Reply:*",
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": response_text[:3000],
                    },
                },
                {"type": "divider"},
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": "_Copy this text and send it as your own message, or close to dismiss._",
                        }
                    ],
                },
            ],
            "close": {"type": "plain_text", "text": "Close"},
        }

        await update_modal(view_id, updated_modal, integration.slack_bot_token)

    except Exception as e:
        LOGGER.error(f"Error generating/updating draft reply: {e}")
        try:
            error_modal = {
                "type": "modal",
                "callback_id": "draft_reply_modal",
                "title": {"type": "plain_text", "text": "Draft Reply"},
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": (
                                ":warning: *An error occurred while generating the draft.*\n\n"
                                "Please try again later."
                            ),
                        },
                    },
                ],
                "close": {"type": "plain_text", "text": "Close"},
            }
            await update_modal(view_id, error_modal, integration.slack_bot_token)
        except Exception as update_error:
            LOGGER.error(f"Failed to update modal with error: {update_error}")


async def handle_configure_command(
    text: str, team_id: str, channel_id: str, user_id: str, command: str
) -> JSONResponse:
    try:
        parts = text.split()

        cmd_name = command

        if len(parts) < 1:
            return JSONResponse(
                content={
                    "response_type": "ephemeral",
                    "text": (
                        "*Usage:*\n"
                        f"• `{cmd_name} show` - Show current settings\n"
                        f"• `{cmd_name} roles role1,role2,role3` - Set allowed RBAC roles\n"
                        f"• `{cmd_name} respond_to mentions_only` - Bot only responds to mentions\n"
                        f"• `{cmd_name} respond_to auto` - Bot automatically determines when to respond\n"
                        f"• `{cmd_name} help` - Show this help message"
                    ),
                }
            )

        action = parts[0]

        if action == "help":
            return JSONResponse(
                content={
                    "response_type": "ephemeral",
                    "text": (
                        "*AskFern Channel Configuration*\n\n"
                        "*Commands:*\n"
                        f"• `{cmd_name} show` - Display current channel settings\n"
                        f"• `{cmd_name} roles role1,role2,role3` - Set allowed RBAC roles (comma-separated)\n"
                        f"• `{cmd_name} respond_to mentions_only` - Bot only responds when mentioned\n"
                        f"• `{cmd_name} respond_to auto` - Bot automatically determines when to respond\n\n"
                        "*Examples:*\n"
                        f"• `{cmd_name} roles admin,developer,support`\n"
                        f"• `{cmd_name} respond_to mentions_only`\n"
                        f"• `{cmd_name} respond_to auto`"
                    ),
                }
            )

        async with async_session_maker() as session:
            result = await session.execute(
                select(SlackIntegrationDb).where(SlackIntegrationDb.slack_team_id == team_id)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": "❌ Slack integration not found. Please install the AskFern bot first.",
                    }
                )

            current_settings = integration.settings or {}
            if not isinstance(current_settings, dict):
                current_settings = {}

            channel_settings = current_settings.get(channel_id, {})
            if not isinstance(channel_settings, dict):
                channel_settings = {}

            if "allowed_roles" not in channel_settings:
                channel_settings["allowed_roles"] = []
            if "respond_to" not in channel_settings:
                channel_settings["respond_to"] = "mentions_only"
            if "domain_override" not in channel_settings:
                channel_settings["domain_override"] = None

            if action == "show":
                settings_obj = ChannelSettings(**channel_settings)
                roles_text = (
                    ", ".join(settings_obj.allowed_roles) if settings_obj.allowed_roles else "None (all users allowed)"
                )
                respond_to_map = {
                    "mentions_only": "Mentions only",
                    "auto": "Auto (intelligent routing)",
                }
                respond_to_text = respond_to_map.get(settings_obj.respond_to, settings_obj.respond_to)

                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": (
                            f"*Current settings for <#{channel_id}>:*\n"
                            f"• *Allowed roles:* {roles_text}\n"
                            f"• *Respond to:* {respond_to_text}"
                        ),
                    }
                )

            elif action == "roles":
                if len(parts) < 2:
                    return JSONResponse(
                        content={
                            "response_type": "ephemeral",
                            "text": (
                                "❌ Please provide roles. " f"Example: `{cmd_name} roles admin,developer,support`"
                            ),
                        }
                    )

                roles_str = " ".join(parts[1:])
                roles = [role.strip() for role in roles_str.split(",") if role.strip()]

                channel_settings["allowed_roles"] = roles

                if current_settings is None:
                    current_settings = {}
                current_settings[channel_id] = channel_settings

                integration.settings = current_settings
                attributes.flag_modified(integration, "settings")

                await session.commit()
                await session.refresh(integration)

                roles_text = ", ".join(roles) if roles else "None (all users allowed)"
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": f"✅ Updated allowed roles for <#{channel_id}>: {roles_text}",
                    }
                )

            elif action == "respond_to":
                if len(parts) < 2:
                    return JSONResponse(
                        content={
                            "response_type": "ephemeral",
                            "text": (
                                "❌ Please specify 'mentions_only' or 'auto'. " f"Example: `{cmd_name} respond_to auto`"
                            ),
                        }
                    )

                mode = parts[1].lower()
                if mode not in ["mentions_only", "auto"]:
                    return JSONResponse(
                        content={
                            "response_type": "ephemeral",
                            "text": "❌ Invalid mode. Use 'mentions_only' or 'auto'.",
                        }
                    )

                channel_settings["respond_to"] = mode

                if current_settings is None:
                    current_settings = {}
                current_settings[channel_id] = channel_settings

                integration.settings = current_settings
                attributes.flag_modified(integration, "settings")

                LOGGER.info(f"Updating channel settings for {channel_id}: {channel_settings}")
                LOGGER.info(f"Full settings to save: {current_settings}")

                await session.commit()
                await session.refresh(integration)

                LOGGER.info(f"Settings after commit: {integration.settings}")

                respond_to_map = {
                    "mentions_only": "mentions only",
                    "auto": "messages automatically (using intelligent routing)",
                }
                respond_to_text = respond_to_map.get(mode, mode)
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": f"✅ Updated response mode for <#{channel_id}>: Bot will respond to {respond_to_text}",
                    }
                )

            elif action == "domain_override":
                if len(parts) < 2:
                    current_domain = channel_settings.get("domain_override")
                    if current_domain:
                        return JSONResponse(
                            content={
                                "response_type": "ephemeral",
                                "text": f"Current domain override for <#{channel_id}>: `{current_domain}`",
                            }
                        )
                    else:
                        default_domain = integration.domain
                        return JSONResponse(
                            content={
                                "response_type": "ephemeral",
                                "text": f"No domain override set for <#{channel_id}>. "
                                f"Using default: `{default_domain}`",
                            }
                        )

                domain = " ".join(parts[1:])
                if domain.lower() == "clear" or domain.lower() == "none":
                    channel_settings["domain_override"] = None
                    domain_text = "cleared (using default)"
                else:
                    channel_settings["domain_override"] = domain
                    domain_text = f"`{domain}`"

                if current_settings is None:
                    current_settings = {}
                current_settings[channel_id] = channel_settings

                integration.settings = current_settings
                attributes.flag_modified(integration, "settings")

                LOGGER.info(f"Updating domain override for {channel_id}: {domain}")

                await session.commit()
                await session.refresh(integration)

                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": f"✅ Updated domain override for <#{channel_id}>: {domain_text}",
                    }
                )

            else:
                return JSONResponse(
                    content={
                        "response_type": "ephemeral",
                        "text": f"❌ Unknown action '{action}'. Use `{cmd_name} help` for available commands.",
                    }
                )

    except Exception as e:
        LOGGER.error(f"Error handling configure command: {e}")
        return JSONResponse(
            content={
                "response_type": "ephemeral",
                "text": "❌ An error occurred while updating settings. Please try again.",
            }
        )


async def handle_message(event: dict[str, Any], team_id: str) -> None:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel")
    message_ts = event.get("ts")

    LOGGER.info(f"Message from {user} in {channel}: {text}")

    response = await handle_slack_message(event, team_id, is_app_mention=False)

    if not response.response_text or not response.bot_token:
        return

    if message_ts and channel and response.bot_token:
        message_exists = await check_message_exists(channel, message_ts, response.bot_token)
        if not message_exists:
            LOGGER.info(f"Original message {message_ts} was deleted, skipping response")
            return

    client = AsyncWebClient(token=response.bot_token)
    success = False
    bot_message_ts = None

    try:
        msg_response = await client.chat_postMessage(
            channel=response.channel,
            text=response.response_text,
            thread_ts=response.thread_ts,
            unfurl_links=False,
            unfurl_media=False,
        )
        success = msg_response["ok"]
        bot_message_ts = msg_response.get("ts") if success else None

        if success and response.user_id and bot_message_ts:
            feedback_thread_ts = response.thread_ts

            if not response.query_id:
                LOGGER.warning(f"No query_id for feedback, but still sending feedback request for message {message_ts}")

            LOGGER.info(
                f"Sending feedback ephemeral - thread_ts: {feedback_thread_ts}, "
                f"bot_message_ts: {bot_message_ts}, channel: {response.channel}, "
                f"original_event_thread_ts: {event.get('thread_ts')}"
            )

            if response.bot_token and message_ts and channel:
                await remove_reaction(channel, message_ts, "eyes", response.bot_token)
                await add_reaction(channel, message_ts, "outbox_tray", response.bot_token)

            await asyncio.sleep(2.5)

            await send_feedback_ephemeral(
                channel=response.channel,
                user=response.user_id,
                bot_token=response.bot_token,
                query_id=response.query_id or "unknown",
                message_ts=bot_message_ts,
                team_id=team_id,
                thread_ts=feedback_thread_ts,
            )

    except Exception as e:
        LOGGER.error(f"Error sending message: {e}")
        success = False
        bot_message_ts = None

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
            new_integration = SlackIntegrationDb(
                domain=domain,
                created_at=datetime.now(UTC),
            )
            session.add(new_integration)
            await session.commit()
            await session.refresh(new_integration)
            integration_id = new_integration.integration_id
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
            "users:read.email",
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


@fai_app.get("/slack/integrations/{domain}", openapi_extra={"x-fern-audiences": ["internal"]})
async def list_slack_integrations(domain: str) -> JSONResponse:
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(SlackIntegrationDb)
                .where(SlackIntegrationDb.domain == domain)
                .order_by(SlackIntegrationDb.created_at.desc())
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
        LOGGER.error(f"Error listing Slack integrations for domain {domain}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list integrations")


@fai_app.get("/slack/get-install/{integration_id}", openapi_extra={"x-fern-audiences": ["internal"]})
async def get_slack_install_link_by_id(integration_id: str) -> JSONResponse:
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(SlackIntegrationDb).where(SlackIntegrationDb.integration_id == integration_id)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                raise HTTPException(status_code=404, detail=f"Integration {integration_id} not found")

            LOGGER.info(
                f"Generating install link for existing integration {integration_id}, domain: {integration.domain}"
            )

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

        install_url = (
            f"https://slack.com/oauth/v2/authorize?"
            f"client_id={VARIABLES.SLACK_CLIENT_ID}&"
            f"scope={quote(scope_string)}&"
            f"state={integration_id}"
        )

        return JSONResponse(
            content={
                "integration_id": integration_id,
                "domain": integration.domain,
                "install_url": install_url,
                "scopes": scopes,
                "slack_team_id": integration.slack_team_id,
                "installed_at": integration.installed_at.isoformat() if integration.installed_at else None,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.error(f"Error generating Slack install link for integration {integration_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate install link")
