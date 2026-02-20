import httpx
from slack_sdk.web.async_client import AsyncWebClient

from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.slack_thread_unfurler import fetch_user_info


def _parse_pr_url(pr_url: str) -> tuple[str, str, str] | None:
    parts = pr_url.rstrip("/").split("/")
    if len(parts) < 7 or parts[2] != "github.com" or parts[5] != "pull":
        return None
    return parts[3], parts[4], parts[6]


def _build_slack_thread_url(channel: str, thread_ts: str) -> str:
    return f"https://slack.com/app_redirect?channel={channel}&message_ts={thread_ts}"


async def _resolve_thread_initiator(bot_token: str, channel: str, thread_ts: str) -> str | None:
    try:
        client = AsyncWebClient(token=bot_token)
        response = await client.conversations_replies(channel=channel, ts=thread_ts, limit=1)
        if not response["ok"]:
            return None
        messages = response.get("messages", [])
        if not messages:
            return None
        user_id = messages[0].get("user")
        if not user_id:
            return None
        return await fetch_user_info(client, user_id)
    except Exception as e:
        LOGGER.warning(f"[SCRIBE] Failed to resolve thread initiator: {e}")
        return None


async def post_pr_comment_with_requester_info(
    pr_url: str,
    slack_channel: str,
    slack_thread_ts: str,
    bot_token: str,
) -> bool:
    parsed = _parse_pr_url(pr_url)
    if not parsed:
        LOGGER.warning(f"[SCRIBE] Cannot parse PR URL for comment: {pr_url}")
        return False

    owner, repo, pr_number = parsed

    github_token = VARIABLES.FERN_GITHUB_TOKEN
    if not github_token:
        LOGGER.warning("[SCRIBE] No FERN_GITHUB_TOKEN configured, skipping PR comment")
        return False

    display_name = await _resolve_thread_initiator(bot_token, slack_channel, slack_thread_ts)

    lines: list[str] = []
    if display_name:
        lines.append(f"**Requested by:** {display_name}")
    thread_url = _build_slack_thread_url(slack_channel, slack_thread_ts)
    lines.append(f"**Slack thread:** [View conversation]({thread_url})")
    comment_body = "\n".join(lines)

    try:
        api_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {github_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                api_url,
                headers=headers,
                json={"body": comment_body},
            )
            response.raise_for_status()

        LOGGER.info(f"[SCRIBE] Posted PR comment with requester info: {pr_url}")
        return True

    except httpx.HTTPStatusError as e:
        LOGGER.error(f"[SCRIBE] GitHub API error posting PR comment for {pr_url}: {e}")
        return False
    except Exception as e:
        LOGGER.error(f"[SCRIBE] Error posting PR comment for {pr_url}: {e}")
        return False
