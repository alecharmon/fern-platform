from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)


async def log_merged_pr_for_qa(session_db: ScribeSessionDb, status: str) -> None:
    try:
        qa_channel_id = "C0A0YHMKJUT"
        qa_bot_token = VARIABLES.SCRIBE_SLACK_BOT_TOKEN

        async with async_session_maker() as session:
            result = await session.execute(
                select(ScribeIntegrationDb).where(ScribeIntegrationDb.integration_id == session_db.integration_id)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                LOGGER.warning(f"[SCRIBE] No integration found for session {session_db.id}")
                return

        client = AsyncWebClient(token=qa_bot_token)

        if status == "merged":
            title = "*SCRIBE PR MERGED* ✅"
        elif status == "closed":
            title = "*SCRIBE PR CLOSED* ❌"
        else:
            title = f"*SCRIBE PR {status.upper()}*"

        message_text = f"""{title}

*Repository:* `{integration.github_repo}`
*PR URL:* {session_db.pr_url}
*Team:* {integration.slack_team_name or 'Unknown'}
"""

        if session_db.devin_session_url:
            message_text += f"*Devin Session:* {session_db.devin_session_url}\n"
        if session_db.slack_thread_ts:
            message_text += f"*Slack Thread:* https://slack.com/app_redirect?channel={session_db.slack_channel}&message_ts={session_db.slack_thread_ts}\n"

        await client.chat_postMessage(
            channel=qa_channel_id,
            text=message_text,
            mrkdwn=True,
        )

        LOGGER.info(f"[SCRIBE] Sent {status} PR notification to QA channel for {session_db.pr_url}")

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Failed to send PR notification: {e}")
