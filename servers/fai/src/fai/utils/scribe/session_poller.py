import asyncio
import re
from datetime import (
    UTC,
    datetime,
)

import httpx
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.devin_client import get_devin_session_status


def parse_attachments(message_text: str) -> tuple[str, list[str]]:
    attachment_pattern = r'ATTACHMENT:"([^"]+)"'
    attachments = re.findall(attachment_pattern, message_text)
    clean_text = re.sub(attachment_pattern, "", message_text).strip()
    return clean_text, attachments


async def upload_attachment_to_slack(
    client: AsyncWebClient, attachment_url: str, channel: str, thread_ts: str, devin_api_key: str
) -> bool:
    try:
        api_url = attachment_url.replace("https://app.devin.ai/attachments/", "https://api.devin.ai/v1/attachments/")

        LOGGER.info(f"[SCRIBE] Downloading attachment from: {api_url}")
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
            headers = {"Authorization": f"Bearer {devin_api_key}"}
            response = await http_client.get(api_url, headers=headers)
            response.raise_for_status()
            file_content = response.content

        filename = attachment_url.split("/")[-1]
        LOGGER.info(f"[SCRIBE] Uploading file to channel: {channel}, thread: {thread_ts}")

        upload_response = await client.files_upload_v2(
            channel=channel,
            content=file_content,
            filename=filename,
            thread_ts=thread_ts,
        )

        if upload_response["ok"]:
            LOGGER.info(f"[SCRIBE] Successfully uploaded attachment to Slack: {filename}")
            return True
        else:
            LOGGER.error(f"[SCRIBE] Failed to upload attachment: {upload_response}")
            return False

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error uploading attachment to Slack: {e}")
        return False


async def poll_devin_session(
    session_id: str,
    devin_session_id: str,
    slack_channel: str,
    slack_thread_ts: str,
    bot_token: str,
    initial_delay: float = 0.0,
) -> None:
    client = AsyncWebClient(token=bot_token)
    poll_interval = 15

    async with async_session_maker() as db_session:
        result = await db_session.execute(select(ScribeSessionDb).where(ScribeSessionDb.id == session_id))
        session_record = result.scalar_one_or_none()
        last_event_id = session_record.last_message_event_id if session_record else None

    LOGGER.info(f"[SCRIBE] Starting polling for Devin session {devin_session_id} (last_event_id={last_event_id})")

    if initial_delay > 0:
        LOGGER.info(f"[SCRIBE] Waiting {initial_delay}s before first poll (resumed session)")
        await asyncio.sleep(initial_delay)

    while True:
        try:
            status = await get_devin_session_status(devin_session_id)
            status_enum = status.get("status_enum")
            messages = status.get("messages", [])

            if last_event_id:
                last_event_index = next(
                    (i for i, msg in enumerate(messages) if msg.get("event_id") == last_event_id), -1
                )
                new_messages = messages[last_event_index + 1 :] if last_event_index >= 0 else []
            else:
                new_messages = messages

            for message in new_messages:
                if message.get("type") == "devin_message":
                    message_text = message.get("message", "")
                    message_event_id = message.get("event_id")
                    if message_text:
                        try:
                            clean_text, attachment_urls = parse_attachments(message_text)

                            if clean_text:
                                await client.chat_postMessage(
                                    channel=slack_channel,
                                    text=clean_text,
                                    thread_ts=slack_thread_ts,
                                    unfurl_links=False,
                                    unfurl_media=False,
                                )
                                LOGGER.info(
                                    f"[SCRIBE] Posted Devin message to Slack thread (event_id={message_event_id})"
                                )

                            for attachment_url in attachment_urls:
                                await upload_attachment_to_slack(
                                    client,
                                    attachment_url,
                                    slack_channel,
                                    slack_thread_ts,
                                    VARIABLES.SCRIBE_DEVIN_API_KEY,
                                )

                            last_event_id = message_event_id
                        except Exception as e:
                            LOGGER.error(f"[SCRIBE] Failed to post message to Slack: {e}")

            async with async_session_maker() as db_session:
                result = await db_session.execute(select(ScribeSessionDb).where(ScribeSessionDb.id == session_id))
                session_record = result.scalar_one_or_none()
                if session_record:
                    session_record.status = status_enum or status.get("status", "unknown")
                    session_record.updated_at = datetime.now(UTC)
                    if last_event_id:
                        session_record.last_message_event_id = last_event_id
                    await db_session.commit()

            if status_enum in ["blocked", "stopped"]:
                LOGGER.info(f"[SCRIBE] Devin session {devin_session_id} reached terminal state: {status_enum}")
                break
            LOGGER.info(f"[SCRIBE] Devin session {devin_session_id} is in state: {status_enum}")
            await asyncio.sleep(poll_interval)

        except Exception as e:
            LOGGER.error(f"[SCRIBE] Error polling Devin session {devin_session_id}: {e}")
            await asyncio.sleep(poll_interval)
