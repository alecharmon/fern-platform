import asyncio
import re
from datetime import (
    UTC,
    datetime,
)

import httpx
from slack_sdk.web.async_client import AsyncWebClient

from fai.db import async_session_maker
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.db_helpers import get_scribe_session_by_id
from fai.utils.scribe.devin_client import get_devin_session_status
from fai.utils.slack.client import send_slack_message
from fai.utils.slack.postprocessing import slackify_markdown

FILTERED_MESSAGE_PATTERNS = [
    r"Warning: your clone commands for .* failed to run and returned with a return code",
    r"This could cause Devin to develop on outdated code",
]


def should_filter_message(message_text: str) -> bool:
    for pattern in FILTERED_MESSAGE_PATTERNS:
        if re.search(pattern, message_text, re.IGNORECASE):
            return True
    return False


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

    session_record = await get_scribe_session_by_id(session_id)
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
            pull_request = status.get("pull_request")

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
                    if message_text and message_event_id:
                        try:
                            if should_filter_message(message_text):
                                LOGGER.info(f"[SCRIBE] Filtered out message: {message_text[:100]}...")
                                last_event_id = message_event_id
                                continue

                            clean_text, attachment_urls = parse_attachments(message_text)

                            if clean_text:
                                message_key = f"scribe:{session_id}:{message_event_id}"
                                await send_slack_message(
                                    channel=slack_channel,
                                    text=slackify_markdown(clean_text),
                                    bot_token=bot_token,
                                    thread_ts=slack_thread_ts,
                                    message_key=message_key,
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

            pr_was_created = False
            async with async_session_maker() as db_session:
                session_record = await get_scribe_session_by_id(session_id, db=db_session)
                if session_record:
                    session_record.status = status_enum or status.get("status", "unknown")
                    session_record.updated_at = datetime.now(UTC)
                    if last_event_id:
                        session_record.last_message_event_id = last_event_id

                    if pull_request and not session_record.pr_url:
                        pr_url = pull_request.get("url")
                        if pr_url:
                            session_record.pr_url = pr_url
                            session_record.pr_status = "open"
                            pr_was_created = True
                            LOGGER.info(f"[SCRIBE] Stored PR URL for session {session_id}: {pr_url}")

                    await db_session.commit()

            if pr_was_created and session_record:
                from fai.utils.scribe.pr_qa_logger import log_pr_created_for_qa
                from fai.utils.scribe.pr_summary_updater import post_pr_comment_with_requester_info

                try:
                    await log_pr_created_for_qa(session_record)
                except Exception as e:
                    LOGGER.error(f"[SCRIBE] Failed to send PR created notification to QA channel: {e}")

                try:
                    await post_pr_comment_with_requester_info(
                        pr_url=session_record.pr_url,
                        slack_channel=slack_channel,
                        slack_thread_ts=slack_thread_ts,
                        bot_token=bot_token,
                    )
                except Exception as e:
                    LOGGER.error(f"[SCRIBE] Failed to post PR comment with requester info: {e}")

            if status_enum in ["blocked", "stopped"]:
                LOGGER.info(f"[SCRIBE] Devin session {devin_session_id} reached terminal state: {status_enum}")
                break
            LOGGER.info(f"[SCRIBE] Devin session {devin_session_id} is in state: {status_enum}")
            await asyncio.sleep(poll_interval)

        except Exception as e:
            LOGGER.error(f"[SCRIBE] Error polling Devin session {devin_session_id}: {e}")
            await asyncio.sleep(poll_interval)
