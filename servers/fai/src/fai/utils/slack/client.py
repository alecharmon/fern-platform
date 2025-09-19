from slack_sdk.errors import SlackApiError
from slack_sdk.web.async_client import AsyncWebClient

from src.settings import LOGGER


async def send_slack_message(channel: str, text: str, bot_token: str, thread_ts: str | None = None) -> bool:
    try:
        client = AsyncWebClient(token=bot_token)

        response = await client.chat_postMessage(channel=channel, text=text, thread_ts=thread_ts)

        if response["ok"]:
            LOGGER.info("Successfully sent response to Slack")
            return True
        else:
            LOGGER.error(f"Slack API returned not ok: {response}")
            return False

    except SlackApiError as e:
        LOGGER.error(f"Slack API error: {e.response['error']}")
        return False
    except Exception as e:
        LOGGER.error(f"Error sending Slack message: {e}")
        return False


async def send_error_message(
    channel: str,
    bot_token: str,
    thread_ts: str | None = None,
    error_text: str = "Sorry, I encountered an error while processing your request. Please try again later.",
) -> None:
    await send_slack_message(channel, error_text, bot_token, thread_ts)


async def add_reaction(channel: str, timestamp: str, reaction: str, bot_token: str) -> bool:
    """Add a reaction to a Slack message."""
    try:
        client = AsyncWebClient(token=bot_token)
        response = await client.reactions_add(channel=channel, timestamp=timestamp, name=reaction)
        if response["ok"]:
            LOGGER.info(f"Successfully added {reaction} reaction")
            return True
        else:
            LOGGER.error(f"Failed to add reaction: {response}")
            return False
    except SlackApiError as e:
        if e.response["error"] == "already_reacted":
            LOGGER.info(f"Already reacted with {reaction}")
            return True
        LOGGER.error(f"Slack API error adding reaction: {e.response['error']}")
        return False
    except Exception as e:
        LOGGER.error(f"Error adding reaction: {e}")
        return False


async def remove_reaction(channel: str, timestamp: str, reaction: str, bot_token: str) -> bool:
    """Remove a reaction from a Slack message."""
    try:
        client = AsyncWebClient(token=bot_token)
        response = await client.reactions_remove(channel=channel, timestamp=timestamp, name=reaction)
        if response["ok"]:
            LOGGER.info(f"Successfully removed {reaction} reaction")
            return True
        else:
            LOGGER.error(f"Failed to remove reaction: {response}")
            return False
    except SlackApiError as e:
        if e.response["error"] == "no_reaction":
            LOGGER.info(f"No {reaction} reaction to remove")
            return True
        LOGGER.error(f"Slack API error removing reaction: {e.response['error']}")
        return False
    except Exception as e:
        LOGGER.error(f"Error removing reaction: {e}")
        return False
