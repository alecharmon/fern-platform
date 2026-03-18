import asyncio
import random
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import sentry_sdk
from sqlalchemy import select

from fai.credits.client import get_credit_client
from fai.credits.config import is_credit_gated
from fai.db import async_session_maker
from fai.models.api.scribe_channel_settings import ScribeChannelSettings
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import LOGGER, VARIABLES
from fai.utils.scribe.db_helpers import get_scribe_integration_by_team_id, get_scribe_session_by_id
from fai.utils.scribe.devin_client import DevinClient, create_or_get_devin_session, send_devin_message
from fai.utils.scribe.generate_startup_message import PLANT_FACTS, STARTUP_INITIAL_MESSAGE
from fai.utils.scribe.session_poller import poll_devin_session
from fai.utils.scribe.slack_file_handler import AttachmentResult, process_slack_attachments
from fai.utils.scribe.slack_thread_unfurler import (
    fetch_thread_messages,
    fetch_user_info,
    format_thread_as_context,
    unfurl_thread_links,
)

ERROR_RESPONSE = "❌ An unknown error has occurred. Please reach out to support@buildwithfern.com."


async def _post_slack_warning(bot_token: str, channel: str, thread_ts: str | None, text: str) -> None:
    try:
        from slack_sdk.web.async_client import AsyncWebClient

        client = AsyncWebClient(token=bot_token)
        await client.chat_postMessage(
            channel=channel,
            text=text,
            thread_ts=thread_ts,
            unfurl_links=False,
            unfurl_media=False,
        )
    except Exception as e:
        sentry_sdk.capture_exception(e, extras={"channel": channel})
        LOGGER.warning(f"[SCRIBE] Failed to post attachment warning to Slack: {e}")


@dataclass
class ScribeMessageResponse:
    response_text: str
    channel: str
    thread_ts: str | None
    bot_token: str | None


async def get_scribe_integration(team_id: str) -> ScribeIntegrationDb | None:
    return await get_scribe_integration_by_team_id(team_id)


async def get_or_create_session(
    integration_id: str,
    thread_ts: str,
    channel: str,
    github_repo: str,
    user_message: str,
    files: list[dict[str, Any]],
    bot_token: str,
) -> tuple[ScribeSessionDb, bool, list[str]]:
    async with async_session_maker() as session:
        result = await session.execute(
            select(ScribeSessionDb).where(
                ScribeSessionDb.integration_id == integration_id, ScribeSessionDb.slack_thread_ts == thread_ts
            )
        )
        existing_session = result.scalar_one_or_none()

        if existing_session:
            LOGGER.info(f"[SCRIBE] Found existing session for thread {thread_ts}")
            return existing_session, False, []

        LOGGER.info(f"[SCRIBE] Creating new Devin session for thread {thread_ts}")

        attachment_result = AttachmentResult()
        if files:
            devin_client = DevinClient(VARIABLES.SCRIBE_DEVIN_API_KEY)
            attachment_result = await process_slack_attachments(files, bot_token, devin_client)

        devin_response = await create_or_get_devin_session(github_repo, user_message, attachment_result.urls)

        new_session = ScribeSessionDb(
            integration_id=integration_id,
            devin_session_id=devin_response.get("session_id"),
            devin_session_url=devin_response.get("url"),
            slack_thread_ts=thread_ts,
            slack_channel=channel,
            status="new",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(new_session)
        await session.commit()
        await session.refresh(new_session)

        LOGGER.info(f"[SCRIBE] Created session record: {new_session.id}")
        return new_session, True, attachment_result.failed_filenames


async def handle_scribe_message(event: dict[str, Any], team_id: str) -> ScribeMessageResponse:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel", "")
    thread_ts = event.get("thread_ts") or event.get("ts")
    files = event.get("files", [])

    LOGGER.info(f"[SCRIBE] Processing message from {user} in {channel}: {text}")
    LOGGER.info(f"[SCRIBE] Event has {len(files)} files: {[f.get('name') for f in files]}")
    LOGGER.info(f"[SCRIBE] Full event keys: {list(event.keys())}")

    integration = await get_scribe_integration(team_id)
    if not integration:
        LOGGER.error(f"[SCRIBE] No integration found for team {team_id}")
        return ScribeMessageResponse("", "", None, None)

    if not integration.slack_bot_token:
        LOGGER.error(f"[SCRIBE] No bot token found for team {team_id}")
        return ScribeMessageResponse("", "", None, None)

    if not channel:
        LOGGER.error("[SCRIBE] No channel provided in event")
        return ScribeMessageResponse("", "", None, None)

    if not thread_ts:
        LOGGER.error("[SCRIBE] No thread_ts provided in event")
        return ScribeMessageResponse("", "", None, None)

    if integration.org_id:
        credit_client = get_credit_client()
        if credit_client and is_credit_gated(integration.org_id):
            try:
                credit_result = await credit_client.check_credits(
                    integration.github_repo, org_id=integration.org_id
                )
                if not credit_result.allowed:
                    LOGGER.info(f"[SCRIBE] Credit limit reached for org {integration.org_id}")
                    return ScribeMessageResponse(
                        response_text="AI credit limit reached. Please contact your administrator.",
                        channel=channel,
                        thread_ts=thread_ts,
                        bot_token=integration.slack_bot_token,
                    )
            except Exception as e:
                LOGGER.error(f"[SCRIBE] Credit check failed, allowing request: {e}")

    if integration.slack_bot_user_id and text:
        text = text.replace(f"<@{integration.slack_bot_user_id}>", "").strip()

    text, thread_context = await unfurl_thread_links(text, integration.slack_bot_token)

    if thread_context:
        text = f"{thread_context}\n{text}"

    async with async_session_maker() as session:
        result = await session.execute(
            select(ScribeSessionDb).where(
                ScribeSessionDb.integration_id == integration.integration_id,
                ScribeSessionDb.slack_thread_ts == thread_ts,
            )
        )
        existing_session = result.scalar_one_or_none()

    current_msg_ts = event.get("ts")
    is_reply_in_existing_thread = thread_ts != current_msg_ts
    is_new_session = existing_session is None

    if is_reply_in_existing_thread and is_new_session:
        LOGGER.info(f"[SCRIBE] Bot tagged in existing thread {thread_ts} (new session), fetching thread history")
        try:
            from slack_sdk.web.async_client import AsyncWebClient

            client = AsyncWebClient(token=integration.slack_bot_token)
            thread_messages = await fetch_thread_messages(client, channel, thread_ts)

            if thread_messages:
                messages_before_mention = [msg for msg in thread_messages if msg.get("ts", "") < current_msg_ts]

                if messages_before_mention:
                    LOGGER.info(
                        f"[SCRIBE] Found {len(messages_before_mention)} messages before current mention in thread"
                    )

                    user_cache: dict[str, str] = {}
                    for msg in messages_before_mention:
                        user_id = msg.get("user")
                        if user_id and user_id not in user_cache:
                            user_cache[user_id] = await fetch_user_info(client, user_id)

                    existing_thread_context = format_thread_as_context(messages_before_mention, user_cache)

                    if existing_thread_context:
                        text = f"{existing_thread_context}\n{text}"
                        LOGGER.info("[SCRIBE] Added existing thread context to message")
                else:
                    LOGGER.info("[SCRIBE] No messages found before current mention")
            else:
                LOGGER.warning(f"[SCRIBE] Failed to fetch thread messages for {thread_ts}")

        except Exception as e:
            sentry_sdk.capture_exception(e, extras={"channel": channel, "thread_ts": thread_ts})
            LOGGER.warning(f"[SCRIBE] Error fetching existing thread context: {e}, proceeding without it")
    elif existing_session:
        LOGGER.info(f"[SCRIBE] Existing session found for thread {thread_ts}, skipping thread context loading")

    github_repo = integration.github_repo

    current_settings = integration.settings or {}
    channel_settings_dict = current_settings.get(channel, {})
    if isinstance(channel_settings_dict, dict):
        try:
            channel_settings = ScribeChannelSettings(**channel_settings_dict)
            if channel_settings.repo_override:
                github_repo = channel_settings.repo_override
                LOGGER.info(f"[SCRIBE] Using repo override for channel {channel}: {github_repo}")
        except Exception as e:
            LOGGER.warning(f"[SCRIBE] Failed to parse channel settings: {e}")

    try:
        session_record, is_new_session, failed_filenames = await get_or_create_session(
            integration.integration_id, thread_ts, channel, github_repo, text, files, integration.slack_bot_token
        )

        if failed_filenames:
            failed_list = ", ".join(failed_filenames)
            await _post_slack_warning(
                integration.slack_bot_token,
                channel,
                thread_ts,
                f"Sorry, I failed to process these attachments: {failed_list}",
            )

        if is_new_session:
            asyncio.create_task(
                poll_devin_session(
                    session_record.id,
                    session_record.devin_session_id,
                    channel,
                    thread_ts,
                    integration.slack_bot_token,
                    github_repo=github_repo,
                    org_id=integration.org_id,
                )
            )
            plant_fact = random.choice(PLANT_FACTS)
            return ScribeMessageResponse(
                response_text=STARTUP_INITIAL_MESSAGE.format(github_repo=github_repo, plant_fact=plant_fact),
                channel=channel,
                thread_ts=thread_ts,
                bot_token=integration.slack_bot_token,
            )
        else:
            _, followup_failed = await send_devin_message(
                session_record.devin_session_id, text, files, integration.slack_bot_token
            )
            if followup_failed:
                failed_list = ", ".join(followup_failed)
                await _post_slack_warning(
                    integration.slack_bot_token,
                    channel,
                    thread_ts,
                    f"Sorry, I failed to process these attachments: {failed_list}",
                )

            if session_record.status in ["blocked", "stopped"]:
                LOGGER.info(
                    f"[SCRIBE] Session {session_record.devin_session_id} was in terminal state, resuming polling"
                )

                async with async_session_maker() as db_session:
                    db_record = await get_scribe_session_by_id(session_record.id, db=db_session)
                    if db_record:
                        db_record.status = "running"
                        db_record.updated_at = datetime.now(UTC)
                        await db_session.commit()

                asyncio.create_task(
                    poll_devin_session(
                        session_record.id,
                        session_record.devin_session_id,
                        channel,
                        thread_ts,
                        integration.slack_bot_token,
                        initial_delay=15.0,
                        github_repo=github_repo,
                        org_id=integration.org_id,
                    )
                )

            return ScribeMessageResponse("", channel, thread_ts, integration.slack_bot_token)

    except Exception as e:
        sentry_sdk.capture_exception(e, extras={"channel": channel, "thread_ts": thread_ts, "team_id": team_id})
        LOGGER.error(f"[SCRIBE] Error handling message: {e}")
        return ScribeMessageResponse(ERROR_RESPONSE, channel, thread_ts, integration.slack_bot_token)
