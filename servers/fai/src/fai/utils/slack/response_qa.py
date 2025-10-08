from slack_sdk.web.async_client import AsyncWebClient

from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.slack.message_handler import (
    SlackMessageResponse,
    get_slack_integration,
)


async def log_message_for_qa(response: SlackMessageResponse, team_id: str, original_message: str) -> None:
    """
    Send Slack messages and responses to a QA channel for evaluation purposes.

    Args:
        response: The SlackMessageResponse containing the bot's response details
        team_id: The Slack team ID
        original_message: The original user message that the bot is responding to
    """
    try:
        if not response.response_text or not response.query_id:
            LOGGER.debug("Skipping QA log: missing response text or query_id")
            return

        qa_channel_id = "C09HWEEDXHB"
        qa_bot_token = VARIABLES.ASK_FERN_SLACK_BOT_TOKEN

        if not qa_channel_id or not qa_bot_token:
            LOGGER.debug("Skipping QA log: ASK_FERN_SLACK_BOT_TOKEN not configured")
            return

        integration = await get_slack_integration(team_id)
        team_name = integration.slack_team_name if integration else team_id

        client = AsyncWebClient(token=qa_bot_token)

        message_text = f"""
*NEW RESPONSE*
*Team:* {team_name}
*Sent in:* <#{response.channel}>
*User:* <@{response.user_id}>
*Query ID:* `{response.query_id}`

*Original Message:*
{original_message}

*Response:*
{response.response_text}
"""

        await client.chat_postMessage(
            channel=qa_channel_id,
            text=message_text,
            mrkdwn=True,
        )

        LOGGER.info(f"Sent QA log to channel {qa_channel_id} for query_id: {response.query_id}")

    except Exception as e:
        LOGGER.error(f"Failed to send message for QA: {e}")
