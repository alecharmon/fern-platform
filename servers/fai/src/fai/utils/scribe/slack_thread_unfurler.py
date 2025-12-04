import re
from typing import Any

from slack_sdk.web.async_client import AsyncWebClient

from fai.settings import LOGGER


def extract_slack_thread_urls(text: str) -> list[dict[str, str]]:
    slack_wrapped_pattern = r"<(https://[\w\-]+\.slack\.com/archives/(C[A-Z0-9]+)/p(\d+)(?:\?thread_ts=(\d+\.\d+))?(?:&cid=[A-Z0-9]+)?)(?:\|[^>]+)?>"
    plain_url_pattern = r"(?<!<)https://[\w\-]+\.slack\.com/archives/(C[A-Z0-9]+)/p(\d+)(?:\?thread_ts=(\d+\.\d+))?(?:&cid=[A-Z0-9]+)?(?![>\|])"

    threads = []
    seen_urls = set()

    for match in re.finditer(slack_wrapped_pattern, text):
        url = match.group(1)
        channel_id = match.group(2)
        message_ts_raw = match.group(3)
        thread_ts = match.group(4)

        if url in seen_urls:
            continue
        seen_urls.add(url)

        message_ts = f"{message_ts_raw[:10]}.{message_ts_raw[10:]}"

        threads.append(
            {
                "url": match.group(0),
                "actual_url": url,
                "channel_id": channel_id,
                "message_ts": thread_ts if thread_ts else message_ts,
                "thread_ts": thread_ts if thread_ts else message_ts,
            }
        )
        LOGGER.info(f"[SCRIBE] Extracted Slack thread URL: {url} (channel: {channel_id}, ts: {message_ts})")

    for match in re.finditer(plain_url_pattern, text):
        url = match.group(0)
        channel_id = match.group(1)
        message_ts_raw = match.group(2)
        thread_ts = match.group(3)

        if url in seen_urls:
            continue
        seen_urls.add(url)

        message_ts = f"{message_ts_raw[:10]}.{message_ts_raw[10:]}"

        threads.append(
            {
                "url": url,
                "actual_url": url,
                "channel_id": channel_id,
                "message_ts": thread_ts if thread_ts else message_ts,
                "thread_ts": thread_ts if thread_ts else message_ts,
            }
        )
        LOGGER.info(f"[SCRIBE] Extracted Slack thread URL: {url} (channel: {channel_id}, ts: {message_ts})")

    return threads


async def fetch_thread_messages(
    client: AsyncWebClient,
    channel_id: str,
    thread_ts: str,
) -> list[dict[str, Any]]:
    try:
        response = await client.conversations_replies(
            channel=channel_id,
            ts=thread_ts,
            limit=100,
        )

        if not response["ok"]:
            LOGGER.error(f"[SCRIBE] Failed to fetch thread: {response.get('error')}")
            return []

        messages = response.get("messages", [])
        LOGGER.info(f"[SCRIBE] Fetched {len(messages)} messages from thread {thread_ts}")
        return messages

    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error fetching thread {thread_ts}: {e}")
        return []


async def fetch_user_info(client: AsyncWebClient, user_id: str) -> str:
    try:
        response = await client.users_info(user=user_id)
        if response["ok"]:
            user = response.get("user", {})
            real_name = user.get("real_name")
            display_name = user.get("profile", {}).get("display_name")
            name = display_name or real_name or user.get("name", user_id)
            return name
        return user_id
    except Exception:
        return user_id


def format_thread_as_context(messages: list[dict[str, Any]], user_cache: dict[str, str]) -> str:
    if not messages:
        return ""

    lines = ["<thread_context>", "The following is a Slack thread conversation for reference:", ""]

    for i, msg in enumerate(messages):
        user_id = msg.get("user", "Unknown")
        username = user_cache.get(user_id, user_id)
        text = msg.get("text", "")
        msg.get("ts", "")

        if i == 0:
            lines.append(f"[Thread started by {username}]")
        else:
            lines.append(f"[Reply by {username}]")

        lines.append(text)
        lines.append("")

    lines.append("</thread_context>")
    lines.append("")

    return "\n".join(lines)


async def unfurl_thread_links(
    text: str,
    bot_token: str,
) -> tuple[str, str]:
    thread_urls = extract_slack_thread_urls(text)

    if not thread_urls:
        LOGGER.info("[SCRIBE] No thread URLs found in message")
        return text, ""

    LOGGER.info(f"[SCRIBE] Found {len(thread_urls)} thread URL(s) to unfurl")

    client = AsyncWebClient(token=bot_token)
    all_thread_contexts = []
    user_cache: dict[str, str] = {}

    for thread_info in thread_urls:
        LOGGER.info(f"[SCRIBE] Fetching thread {thread_info['thread_ts']} from channel {thread_info['channel_id']}")
        messages = await fetch_thread_messages(
            client,
            thread_info["channel_id"],
            thread_info["thread_ts"],
        )

        if messages:
            LOGGER.info(f"[SCRIBE] Successfully fetched {len(messages)} messages from thread")
            for msg in messages:
                user_id = msg.get("user")
                if user_id and user_id not in user_cache:
                    user_cache[user_id] = await fetch_user_info(client, user_id)

            thread_context = format_thread_as_context(messages, user_cache)
            all_thread_contexts.append(thread_context)

            text = text.replace(thread_info["url"], "[Slack thread - see context below]")
        else:
            LOGGER.warning(f"[SCRIBE] Failed to fetch messages for thread {thread_info['thread_ts']}")

    combined_context = "\n".join(all_thread_contexts)
    LOGGER.info(f"[SCRIBE] Thread unfurling complete, context length: {len(combined_context)}")

    return text, combined_context
