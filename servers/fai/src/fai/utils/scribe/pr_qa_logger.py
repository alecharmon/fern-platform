import sentry_sdk

from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.db_helpers import get_scribe_integration_by_id
from fai.utils.slack.client import send_slack_message

QA_CHANNEL_ID = "C0A0YHMKJUT"


async def log_install_for_qa(integration: ScribeIntegrationDb) -> None:
    try:
        qa_bot_token = VARIABLES.SCRIBE_SLACK_BOT_TOKEN

        message_text = f"""*FERN WRITER SLACK APP INSTALLED* 🎉

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
        sentry_sdk.capture_exception(
            e, extras={"integration_id": integration.integration_id, "slack_team_name": integration.slack_team_name}
        )
        LOGGER.error(f"[SCRIBE] Failed to send install notification: {e}")


async def log_pr_created_for_qa(session_db: ScribeSessionDb) -> None:
    try:
        qa_bot_token = VARIABLES.SCRIBE_SLACK_BOT_TOKEN

        integration = await get_scribe_integration_by_id(session_db.integration_id)

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
            ts_without_dot = session_db.slack_thread_ts.replace(".", "")
            message_text += f"*Slack Thread:* https://app.slack.com/archives/{session_db.slack_channel}/p{ts_without_dot}\n"

        message_key = f"scribe_pr_created_{session_db.id}"
        await send_slack_message(
            channel=QA_CHANNEL_ID,
            text=message_text,
            bot_token=qa_bot_token,
            message_key=message_key,
        )

        LOGGER.info(f"[SCRIBE] Sent PR created notification to QA channel for {session_db.pr_url}")

    except Exception as e:
        sentry_sdk.capture_exception(e, extras={"session_id": session_db.id, "pr_url": session_db.pr_url})
        LOGGER.error(f"[SCRIBE] Failed to send PR created notification: {e}")


async def log_merged_pr_for_qa(session_db: ScribeSessionDb, status: str) -> None:
    try:
        qa_bot_token = VARIABLES.SCRIBE_SLACK_BOT_TOKEN

        integration = await get_scribe_integration_by_id(session_db.integration_id)

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
            ts_without_dot = session_db.slack_thread_ts.replace(".", "")
            message_text += f"*Slack Thread:* https://app.slack.com/archives/{session_db.slack_channel}/p{ts_without_dot}\n"

        message_key = f"scribe_pr_{session_db.id}_{status}"
        await send_slack_message(
            channel=QA_CHANNEL_ID,
            text=message_text,
            bot_token=qa_bot_token,
            message_key=message_key,
        )

        LOGGER.info(f"[SCRIBE] Sent {status} PR notification to QA channel for {session_db.pr_url}")

    except Exception as e:
        sentry_sdk.capture_exception(
            e, extras={"session_id": session_db.id, "pr_url": session_db.pr_url, "status": status}
        )
        LOGGER.error(f"[SCRIBE] Failed to send PR notification: {e}")
