import time
from typing import TypedDict

import httpx
import jwt

from fai.settings import (
    LOGGER,
    VARIABLES,
)


class ValidationError(TypedDict):
    type: str
    message: str


class ValidationResult(TypedDict):
    ok: bool
    error: ValidationError | None


async def validate_scribe_github_repo_access(
    github_repo: str,
) -> ValidationResult:
    parts = github_repo.split("/")
    if len(parts) != 2:
        return {
            "ok": False,
            "error": {
                "type": "INVALID_REPO_FORMAT",
                "message": f"Repository must be in 'owner/repo' format, got: {github_repo}",
            },
        }

    owner, repo = parts

    fern_bot_installed = await check_fern_bot_installed(owner, repo)
    if not fern_bot_installed:
        return {
            "ok": False,
            "error": {
                "type": "FERN_BOT_NOT_INSTALLED",
                "message": f"Fern Bot GitHub App is not installed on {github_repo}. "
                "Please install it at: https://github.com/apps/fern-api/installations/new",
            },
        }

    return {"ok": True, "error": None}


def generate_github_app_jwt() -> str:
    private_key = VARIABLES.FERN_BOT_PRIVATE_KEY
    if not private_key:
        raise ValueError("FERN_BOT_PRIVATE_KEY not set")

    app_id = VARIABLES.FERN_BOT_APP_ID
    if not app_id:
        raise ValueError("FERN_BOT_APP_ID not set")

    formatted_private_key = (
        private_key.replace("\\n", "\n")
        .replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
        .replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----")
        .strip()
    )

    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + (10 * 60),
        "iss": app_id,
    }

    token = jwt.encode(payload, formatted_private_key, algorithm="RS256")
    return token


async def check_fern_bot_installed(owner: str, repo: str) -> bool:
    try:
        jwt_token = generate_github_app_jwt()
        url = f"https://api.github.com/repos/{owner}/{repo}/installation"
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=10.0)

            if response.status_code == 200:
                LOGGER.info(f"Fern Bot is installed on {owner}/{repo}")
                return True
            elif response.status_code == 404:
                LOGGER.warning(f"Fern Bot is not installed on {owner}/{repo}")
                return False
            else:
                LOGGER.error(
                    f"Unexpected status code {response.status_code} checking Fern Bot installation: {response.text}"
                )
                return False

    except httpx.TimeoutException:
        LOGGER.error(f"Timeout checking Fern Bot installation for {owner}/{repo}")
        return False
    except Exception as e:
        LOGGER.error(f"Error checking Fern Bot installation for {owner}/{repo}: {e}")
        return False
