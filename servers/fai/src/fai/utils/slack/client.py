import hashlib
from datetime import UTC, datetime
from typing import Any

from slack_sdk.errors import SlackApiError
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from fai.db import async_session_maker
from fai.models.db.slack_outbound_message_cache_db import SlackOutboundMessageCacheDb
from fai.settings import LOGGER


async def send_slack_message(
    channel: str, text: str, bot_token: str, thread_ts: str | None = None, message_key: str | None = None
) -> bool:
    try:
        if message_key is None:
            content_hash = hashlib.sha256(f"{channel}:{text}:{thread_ts}".encode()).hexdigest()[:16]
            message_key = f"auto:{content_hash}"

        async with async_session_maker() as db_session:
            result = await db_session.execute(
                select(SlackOutboundMessageCacheDb).where(SlackOutboundMessageCacheDb.message_key == message_key)
            )
            existing = result.scalar_one_or_none()

            if existing:
                LOGGER.info(f"Message with key {message_key} already sent, skipping duplicate")
                return True

            cache_entry = SlackOutboundMessageCacheDb(message_key=message_key, sent_at=datetime.now(UTC))
            db_session.add(cache_entry)

            try:
                await db_session.commit()
            except IntegrityError:
                LOGGER.info(f"Message with key {message_key} already sent (race condition), skipping")
                return True

        client = AsyncWebClient(token=bot_token)
        response = await client.chat_postMessage(
            channel=channel, text=text, thread_ts=thread_ts, unfurl_links=False, unfurl_media=False
        )

        if response["ok"]:
            LOGGER.info(f"Successfully sent message to Slack (message_key={message_key})")
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


async def send_ephemeral_message(
    channel: str,
    user: str,
    text: str,
    bot_token: str,
    blocks: list[dict[str, Any]] | None = None,
    thread_ts: str | None = None,
) -> bool:
    try:
        client = AsyncWebClient(token=bot_token)
        args = {
            "channel": channel,
            "user": user,
            "text": text,
            "unfurl_links": False,
            "unfurl_media": False,
        }
        if blocks:
            args["blocks"] = blocks
        if thread_ts:
            args["thread_ts"] = thread_ts
        response = await client.chat_postEphemeral(**args)
        if response["ok"]:
            LOGGER.info("Successfully sent ephemeral message")
            return True
        else:
            LOGGER.error(f"Failed to send ephemeral message: {response}")
            return False
    except SlackApiError as e:
        LOGGER.error(f"Slack API error sending ephemeral message: {e.response['error']}")
        return False
    except Exception as e:
        LOGGER.error(f"Error sending ephemeral message: {e}")
        return False


async def open_modal(trigger_id: str, view: dict[str, Any], bot_token: str) -> str | None:
    try:
        client = AsyncWebClient(token=bot_token)
        response = await client.views_open(trigger_id=trigger_id, view=view)
        if response["ok"]:
            view_id = response.get("view", {}).get("id")
            LOGGER.info(f"Successfully opened modal with view_id: {view_id}")
            return view_id
        else:
            LOGGER.error(f"Failed to open modal: {response}")
            return None
    except SlackApiError as e:
        LOGGER.error(f"Slack API error opening modal: {e.response['error']}")
        return None
    except Exception as e:
        LOGGER.error(f"Error opening modal: {e}")
        return None


async def update_modal(view_id: str, view: dict[str, Any], bot_token: str) -> bool:
    try:
        client = AsyncWebClient(token=bot_token)
        response = await client.views_update(view_id=view_id, view=view)
        if response["ok"]:
            LOGGER.info("Successfully updated modal")
            return True
        else:
            LOGGER.error(f"Failed to update modal: {response}")
            return False
    except SlackApiError as e:
        LOGGER.error(f"Slack API error updating modal: {e.response['error']}")
        return False
    except Exception as e:
        LOGGER.error(f"Error updating modal: {e}")
        return False


async def cleanup_slack_outbound_cache(hours: int = 24) -> None:
    try:
        async with async_session_maker() as db_session:
            cutoff = datetime.now(UTC).timestamp() - (hours * 3600)
            cutoff_datetime = datetime.fromtimestamp(cutoff, UTC)

            result = await db_session.execute(
                select(SlackOutboundMessageCacheDb).where(SlackOutboundMessageCacheDb.sent_at < cutoff_datetime)
            )
            old_entries = result.scalars().all()

            for entry in old_entries:
                await db_session.delete(entry)

            await db_session.commit()
            LOGGER.info(f"Cleaned up {len(old_entries)} old Slack outbound message cache entries")

    except Exception as e:
        LOGGER.error(f"Error cleaning up Slack outbound message cache: {e}")
