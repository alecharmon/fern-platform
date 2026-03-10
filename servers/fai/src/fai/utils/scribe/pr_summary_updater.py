import httpx
import sentry_sdk
from slack_sdk.web.async_client import AsyncWebClient

from fai.settings import (
    LOGGER,
)
from fai.utils.scribe.validate_github_repo import generate_github_app_jwt


def _parse_pr_url(pr_url: str) -> tuple[str, str, str] | None:
    parts = pr_url.rstrip("/").split("/")
    if len(parts) < 7 or parts[2] != "github.com" or parts[5] != "pull":
        return None
    return parts[3], parts[4], parts[6]


def _build_slack_thread_url(channel: str, thread_ts: str) -> str:
    ts_without_dot = thread_ts.replace(".", "")
    return f"https://app.slack.com/archives/{channel}/p{ts_without_dot}"


async def _get_installation_token(owner: str, repo: str) -> str | None:
    """Get a GitHub App installation access token for the given repo."""
    try:
        jwt_token = generate_github_app_jwt()
        url = f"https://api.github.com/repos/{owner}/{repo}/installation"
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            installation_id = resp.json()["id"]

            token_url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
            token_resp = await client.post(token_url, headers=headers)
            token_resp.raise_for_status()
            return token_resp.json()["token"]

    except Exception as e:
        sentry_sdk.capture_exception(e, extras={"owner": owner, "repo": repo})
        LOGGER.error(f"[SCRIBE] Failed to get GitHub App installation token for {owner}/{repo}: {e}")
        return None


async def _resolve_slack_requester(bot_token: str, channel: str, thread_ts: str) -> str:
    """Look up the Slack user who started the thread."""
    try:
        client = AsyncWebClient(token=bot_token)
        result = await client.conversations_replies(channel=channel, ts=thread_ts, limit=1)
        messages = result.get("messages", [])
        if not messages:
            return "Unknown"

        user_id = messages[0].get("user")
        if not user_id:
            return "Unknown"

        user_resp = await client.users_info(user=user_id)
        if user_resp["ok"]:
            user = user_resp.get("user", {})
            display_name = user.get("profile", {}).get("display_name")
            real_name = user.get("real_name")
            return display_name or real_name or user.get("name", "Unknown")

        return "Unknown"
    except Exception as e:
        LOGGER.warning(f"[SCRIBE] Failed to resolve Slack requester: {e}")
        return "Unknown"


async def post_pr_comment_with_requester_info(
    pr_url: str,
    slack_channel: str,
    slack_thread_ts: str,
    bot_token: str,
) -> bool:
    LOGGER.info(
        f"[SCRIBE] post_pr_comment_with_requester_info called with "
        f"pr_url={pr_url}, slack_channel={slack_channel}, slack_thread_ts={slack_thread_ts}"
    )
    parsed = _parse_pr_url(pr_url)
    if not parsed:
        LOGGER.warning(f"[SCRIBE] Cannot parse PR URL for comment: {pr_url}")
        return False

    owner, repo, pr_number = parsed
    LOGGER.info(f"[SCRIBE] Parsed PR URL: owner={owner}, repo={repo}, pr_number={pr_number}")

    github_token = await _get_installation_token(owner, repo)
    if not github_token:
        LOGGER.warning(
            f"[SCRIBE] Could not obtain GitHub App installation token for {owner}/{repo}, skipping PR comment"
        )
        return False

    LOGGER.info(f"[SCRIBE] Got GitHub App token for {owner}/{repo}, resolving Slack requester...")
    requester_name = await _resolve_slack_requester(bot_token, slack_channel, slack_thread_ts)
    LOGGER.info(f"[SCRIBE] Resolved requester name: {requester_name}")

    lines: list[str] = []
    lines.append(f"**Requested by:** {requester_name}")
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
        sentry_sdk.capture_exception(e, extras={"pr_url": pr_url, "owner": owner, "repo": repo, "pr_number": pr_number})
        LOGGER.error(f"[SCRIBE] GitHub API error posting PR comment for {pr_url}: {e}")
        return False
    except Exception as e:
        sentry_sdk.capture_exception(e, extras={"pr_url": pr_url, "owner": owner, "repo": repo, "pr_number": pr_number})
        LOGGER.error(f"[SCRIBE] Error posting PR comment for {pr_url}: {e}")
        return False
