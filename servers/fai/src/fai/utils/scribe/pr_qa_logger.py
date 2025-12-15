from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.slack.client import send_slack_message

QA_CHANNEL_ID = "C0A0YHMKJUT"


async def log_install_for_qa(integration: ScribeIntegrationDb) -> None:
    try:
        qa_bot_token = VARIABLES.SCRIBE_SLACK_BOT_TOKEN

        message_text = f"""*SCRIBE APP INSTALLED* 🎉

*Org:* {integration.slack_team_name or 'Unknown'}
*Repository:* `{integration.github_repo}`
"""

        message_key = f"scribe_install_{integration.integration_id}"
        await send_slack_message(
            channel=QA_CHANNEL_ID,
            text=message_text,
            bot_token=qa_bot_token,
            message_key=message_key,
        )

        LOGGER.info(f"[SCRIBE] Sent install notification to QA channel for {integration.slack_team_name}")

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Failed to send install notification: {e}")


async def log_pr_created_for_qa(session_db: ScribeSessionDb) -> None:
    try:
        qa_bot_token = VARIABLES.SCRIBE_SLACK_BOT_TOKEN

        async with async_session_maker() as session:
            result = await session.execute(
                select(ScribeIntegrationDb).where(ScribeIntegrationDb.integration_id == session_db.integration_id)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                LOGGER.warning(f"[SCRIBE] No integration found for session {session_db.id}")
                return

        message_text = f"""*SCRIBE PR CREATED* 🚀

*Org:* {integration.slack_team_name or 'Unknown'}
*Pull request:* {session_db.pr_url}
"""

        if session_db.devin_session_url:
            message_text += f"*Devin Session:* {session_db.devin_session_url}\n"
        if session_db.slack_thread_ts:
            message_text += f"*Slack Thread:* https://slack.com/app_redirect?channel={session_db.slack_channel}&message_ts={session_db.slack_thread_ts}\n"

        message_key = f"scribe_pr_created_{session_db.id}"
        await send_slack_message(
            channel=QA_CHANNEL_ID,
            text=message_text,
            bot_token=qa_bot_token,
            message_key=message_key,
        )

        LOGGER.info(f"[SCRIBE] Sent PR created notification to QA channel for {session_db.pr_url}")

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Failed to send PR created notification: {e}")


async def log_merged_pr_for_qa(session_db: ScribeSessionDb, status: str) -> None:
    try:
        qa_bot_token = VARIABLES.SCRIBE_SLACK_BOT_TOKEN

        async with async_session_maker() as session:
            result = await session.execute(
                select(ScribeIntegrationDb).where(ScribeIntegrationDb.integration_id == session_db.integration_id)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                LOGGER.warning(f"[SCRIBE] No integration found for session {session_db.id}")
                return

        if status == "merged":
            title = "*SCRIBE PR MERGED* ✅"
        elif status == "closed":
            title = "*SCRIBE PR CLOSED* ❌"
        else:
            title = f"*SCRIBE PR {status.upper()}*"

        message_text = f"""{title}

*Org:* {integration.slack_team_name or 'Unknown'}
*Pull request:* {session_db.pr_url}
"""

        if session_db.devin_session_url:
            message_text += f"*Devin Session:* {session_db.devin_session_url}\n"
        if session_db.slack_thread_ts:
            message_text += f"*Slack Thread:* https://slack.com/app_redirect?channel={session_db.slack_channel}&message_ts={session_db.slack_thread_ts}\n"

        message_key = f"scribe_pr_{session_db.id}_{status}"
        await send_slack_message(
            channel=QA_CHANNEL_ID,
            text=message_text,
            bot_token=qa_bot_token,
            message_key=message_key,
        )

        LOGGER.info(f"[SCRIBE] Sent {status} PR notification to QA channel for {session_db.pr_url}")

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Failed to send PR notification: {e}")
