import asyncio
import re
from datetime import (
    UTC,
    datetime,
)

import httpx
import sentry_sdk
from slack_sdk.web.async_client import AsyncWebClient

from fai.credits.client import get_credit_client
from fai.credits.config import ACCU_TO_CREDITS_RATIO, is_credit_gated
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

# Devin internal tags that should be stripped before posting to Slack
DEVIN_INTERNAL_TAG_PATTERN = re.compile(r"\[OFFER_TEST_APP\].*?\[/OFFER_TEST_APP\]", re.DOTALL)

# Pattern to detect PR URLs output by Devin in the format PR_URL=<url>
# Matches lines like: PR_URL=https://github.com/owner/repo/pull/123
PR_URL_PATTERN = re.compile(r"PR_URL=(https://github\.com/[^/]+/[^/]+/pull/\d+)")

# User-friendly message template to replace PR_URL=<url> before posting to Slack
PR_URL_FRIENDLY_TEMPLATE = "Here's the pull request: {url}"


def should_filter_message(message_text: str) -> bool:
    for pattern in FILTERED_MESSAGE_PATTERNS:
        if re.search(pattern, message_text, re.IGNORECASE):
            return True
    return False


def strip_devin_internal_tags(message_text: str) -> str:
    """Remove Devin internal tags (e.g. [OFFER_TEST_APP][/OFFER_TEST_APP]) from message text."""
    return DEVIN_INTERNAL_TAG_PATTERN.sub("", message_text).strip()


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
        sentry_sdk.capture_exception(
            e, extras={"attachment_url": attachment_url, "channel": channel, "thread_ts": thread_ts}
        )
        LOGGER.error(f"[SCRIBE] Error uploading attachment to Slack: {e}")
        return False


async def poll_devin_session(
    session_id: str,
    devin_session_id: str,
    slack_channel: str,
    slack_thread_ts: str,
    bot_token: str,
    initial_delay: float = 0.0,
    github_repo: str | None = None,
    org_id: str | None = None,
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
                            clean_text = strip_devin_internal_tags(clean_text)

                            # Replace PR_URL=<url> with a user-friendly message before posting to Slack
                            pr_match = PR_URL_PATTERN.search(clean_text)
                            if pr_match:
                                pr_url = pr_match.group(1)
                                clean_text = PR_URL_PATTERN.sub(
                                    PR_URL_FRIENDLY_TEMPLATE.format(url=pr_url),
                                    clean_text,
                                )

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
                            sentry_sdk.capture_exception(
                                e,
                                extras={
                                    "session_id": session_id,
                                    "devin_session_id": devin_session_id,
                                    "slack_channel": slack_channel,
                                },
                            )
                            LOGGER.error(f"[SCRIBE] Failed to post message to Slack: {e}")

            # Detect PR URL: first from Devin's native status, then from messages (workspace scripts)
            pr_url_from_status: str | None = None
            if pull_request:
                pr_url_from_status = pull_request.get("url")

            pr_url_from_messages: str | None = None
            if not pr_url_from_status:
                # Search devin_message messages for explicit PR_URL= pattern
                # The Devin prompt instructs Devin to relay the PR URL in this format
                for message in messages:
                    if message.get("type") != "devin_message":
                        continue
                    message_text = message.get("message", "")
                    if message_text:
                        match = PR_URL_PATTERN.search(message_text)
                        if match:
                            pr_url_from_messages = match.group(1)
                            LOGGER.info(f"[SCRIBE] Detected PR URL from PR_URL= pattern: {pr_url_from_messages}")
                            break
                        # Near-miss: devin_message mentions PR-related text but no PR_URL= match
                        if "PR_URL" in message_text or "pull" in message_text.lower():
                            LOGGER.info(
                                f"[SCRIBE] Near-miss: devin_message contains PR-related text "
                                f"but no PR_URL= match: {message_text[:200]}"
                            )

            detected_pr_url = pr_url_from_status or pr_url_from_messages

            pr_was_created = False
            async with async_session_maker() as db_session:
                session_record = await get_scribe_session_by_id(session_id, db=db_session)
                if session_record:
                    session_record.status = status_enum or status.get("status", "unknown")
                    session_record.updated_at = datetime.now(UTC)
                    if last_event_id:
                        session_record.last_message_event_id = last_event_id

                    if detected_pr_url and not session_record.pr_url:
                        session_record.pr_url = detected_pr_url
                        session_record.pr_status = "open"
                        pr_was_created = True
                        LOGGER.info(f"[SCRIBE] Stored PR URL for session {session_id}: {detected_pr_url}")

                    await db_session.commit()

            if org_id and github_repo:
                credit_client = get_credit_client()
                if credit_client and is_credit_gated(org_id):
                    try:
                        pull_requests_data = status.get("pull_requests", [])
                        pr_urls = [pr.get("pr_url") for pr in pull_requests_data if pr.get("pr_url")]
                        entry = {
                            "type": "fern_writer",
                            "metadata": {
                                "github_repo": github_repo,
                                "channel": slack_channel,
                                "response_tokens": 50,
                                "devin_session_id": devin_session_id,
                                "pr_urls": pr_urls,
                                "status": status_enum or "unknown",
                            },
                        }
                        await credit_client.log_usage(
                            domain=github_repo,
                            org_id=org_id,
                            entry=entry,
                        )
                        LOGGER.info(
                            f"[SCRIBE] Logged credit usage for session {devin_session_id}: "
                            f"credits=50"
                        )
                    except Exception as e:
                        LOGGER.error(f"[SCRIBE] Failed to log credit usage: {e}")

            if pr_was_created and session_record:
                from fai.utils.scribe.pr_qa_logger import log_pr_created_for_qa
                from fai.utils.scribe.pr_summary_updater import post_pr_comment_with_requester_info

                LOGGER.info(
                    f"[SCRIBE] PR detected for session {session_id}, posting requester comment. "
                    f"pr_url={session_record.pr_url}"
                )

                try:
                    await log_pr_created_for_qa(session_record)
                except Exception as e:
                    sentry_sdk.capture_exception(e, extras={"session_id": session_id, "pr_url": session_record.pr_url})
                    LOGGER.error(f"[SCRIBE] Failed to send PR created notification to QA channel: {e}")

                try:
                    result = await post_pr_comment_with_requester_info(
                        pr_url=session_record.pr_url,
                        slack_channel=slack_channel,
                        slack_thread_ts=slack_thread_ts,
                        bot_token=bot_token,
                    )
                    if not result:
                        LOGGER.warning(
                            f"[SCRIBE] post_pr_comment_with_requester_info returned False for {session_record.pr_url}"
                        )
                except Exception as e:
                    sentry_sdk.capture_exception(e, extras={"session_id": session_id, "pr_url": session_record.pr_url})
                    LOGGER.error(f"[SCRIBE] Failed to post PR comment with requester info: {e}")

            if status_enum in ["blocked", "stopped"]:
                LOGGER.info(
                    f"[SCRIBE] Devin session {devin_session_id} reached terminal state: {status_enum}, "
                    f"pr_url={session_record.pr_url if session_record else 'no session'}"
                )
                break
            await asyncio.sleep(poll_interval)

        except Exception as e:
            sentry_sdk.capture_exception(
                e,
                extras={"session_id": session_id, "devin_session_id": devin_session_id, "slack_channel": slack_channel},
            )
            LOGGER.error(f"[SCRIBE] Error polling Devin session {devin_session_id}: {e}")
            await asyncio.sleep(poll_interval)
