from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.settings import LOGGER


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


async def handle_scribe_message(event: dict[str, Any], team_id: str) -> ScribeMessageResponse:
    user = event.get("user")
    text = event.get("text", "")
    channel = event.get("channel", "")
    thread_ts = event.get("thread_ts") or event.get("ts")

    LOGGER.info(f"[SCRIBE] App mentioned by {user} in {channel}: {text}")

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

    if integration.slack_bot_user_id and text:
        text = text.replace(f"<@{integration.slack_bot_user_id}>", "").strip()

    github_repo = integration.github_repo
    LOGGER.info(f"[SCRIBE] Processing message for repo {github_repo}: {text}")

    response_text = (
        f"👋 Hello! I'm Scribe for the `{github_repo}` repository. I received your message and logged it successfully."
    )

    return ScribeMessageResponse(
        response_text=response_text, channel=channel, thread_ts=thread_ts, bot_token=integration.slack_bot_token
    )
