import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.api.scribe_channel_settings import ScribeChannelSettings
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import LOGGER, VARIABLES
from fai.utils.scribe.devin_client import DevinClient, create_or_get_devin_session, send_devin_message
from fai.utils.scribe.session_poller import poll_devin_session
from fai.utils.scribe.slack_file_handler import process_slack_attachments
from fai.utils.scribe.slack_thread_unfurler import unfurl_thread_links

STARTUP_RESPONSE = "🚀 Starting a new session for `{github_repo}`..."
ERROR_RESPONSE = "❌ An unknown error has occurred. Please reach out to support@buildwithfern.com."


@dataclass
class ScribeMessageResponse:
    response_text: str
    channel: str
    thread_ts: str | None
    bot_token: str | None


async def get_scribe_integration(team_id: str) -> ScribeIntegrationDb | None:
    async with async_session_maker() as session:
        result = await session.execute(
            select(ScribeIntegrationDb).where(ScribeIntegrationDb.slack_team_id == team_id).limit(1)
        )
        return result.scalar_one_or_none()


async def get_or_create_session(
    integration_id: str,
    thread_ts: str,
    channel: str,
    github_repo: str,
    user_message: str,
    files: list[dict[str, Any]],
    bot_token: str,
) -> tuple[ScribeSessionDb, bool]:
    async with async_session_maker() as session:
        result = await session.execute(
            select(ScribeSessionDb).where(
                ScribeSessionDb.integration_id == integration_id, ScribeSessionDb.slack_thread_ts == thread_ts
            )
        )
        existing_session = result.scalar_one_or_none()

        if existing_session:
            LOGGER.info(f"[SCRIBE] Found existing session for thread {thread_ts}")
            return existing_session, False

        LOGGER.info(f"[SCRIBE] Creating new Devin session for thread {thread_ts}")

        attachment_urls: list[str] = []
        if files:
            devin_client = DevinClient(VARIABLES.SCRIBE_DEVIN_API_KEY)
            attachment_urls = await process_slack_attachments(files, bot_token, devin_client)

        devin_response = await create_or_get_devin_session(github_repo, user_message, attachment_urls)

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
        return new_session, True


async def handle_scribe_message(event: dict[str, Any], team_id: str) -> ScribeMessageResponse:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel", "")
    thread_ts = event.get("thread_ts") or event.get("ts")
    files = event.get("files", [])

    LOGGER.info(f"[SCRIBE] Processing message from {user} in {channel}: {text}")

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

    if integration.slack_bot_user_id and text:
        text = text.replace(f"<@{integration.slack_bot_user_id}>", "").strip()

    text, thread_context = await unfurl_thread_links(text, integration.slack_bot_token)

    if thread_context:
        text = f"{thread_context}\n{text}"

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
        session_record, is_new_session = await get_or_create_session(
            integration.integration_id, thread_ts, channel, github_repo, text, files, integration.slack_bot_token
        )

        if is_new_session:
            asyncio.create_task(
                poll_devin_session(
                    session_record.id,
                    session_record.devin_session_id,
                    channel,
                    thread_ts,
                    integration.slack_bot_token,
                )
            )
            return ScribeMessageResponse(
                response_text=STARTUP_RESPONSE.format(github_repo=github_repo),
                channel=channel,
                thread_ts=thread_ts,
                bot_token=integration.slack_bot_token,
            )
        else:
            await send_devin_message(session_record.devin_session_id, text, files, integration.slack_bot_token)

            if session_record.status in ["blocked", "stopped"]:
                LOGGER.info(
                    f"[SCRIBE] Session {session_record.devin_session_id} was in terminal state, resuming polling"
                )

                async with async_session_maker() as db_session:
                    result = await db_session.execute(
                        select(ScribeSessionDb).where(ScribeSessionDb.id == session_record.id)
                    )
                    db_record = result.scalar_one_or_none()
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
                    )
                )

            return ScribeMessageResponse("", channel, thread_ts, integration.slack_bot_token)

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error handling message: {e}")
        return ScribeMessageResponse(ERROR_RESPONSE, channel, thread_ts, integration.slack_bot_token)
