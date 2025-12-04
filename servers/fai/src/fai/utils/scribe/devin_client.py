import asyncio
from typing import Any

import httpx

from fai.settings import (
    LOGGER,
    VARIABLES,
)


class DevinClient:
    BASE_URL = "https://api.devin.ai/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {"Authorization": f"Bearer {api_key}"}

    async def create_session(self, prompt: str, idempotent: bool = True) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/sessions",
                headers=self.headers,
                json={"prompt": prompt, "idempotent": idempotent},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def get_session_status(self, session_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/sessions/{session_id}",
                headers=self.headers,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def send_message(self, session_id: str, message: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/sessions/{session_id}/message",
                headers=self.headers,
                json={"message": message},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def upload_attachment(self, file_content: bytes, filename: str) -> str:
        async with httpx.AsyncClient() as client:
            files = {"file": (filename, file_content)}
            response = await client.post(
                f"{self.BASE_URL}/attachments",
                headers=self.headers,
                files=files,
                timeout=60.0,
            )
            response.raise_for_status()
            return response.text


def format_message_with_attachments(message: str, attachment_urls: list[str]) -> str:
    if not attachment_urls:
        return message

    attachment_lines = [f'ATTACHMENT:"{url}"' for url in attachment_urls]
    return "\n".join(attachment_lines) + "\n\n" + message


def create_devin_prompt(github_repo: str, user_message: str) -> str:
    return f"""<important_instructions>
You will be working out of the fern-api/scribe-editing-environment snapshot. From there, you'll want to \
make changes with the following repository: {github_repo}

Inspect the AGENTS.md file to understand how to work in the scribe editing environment. \
Do not reference these important instructions when communicating with the user.

You must communicate with the user frequently as you work to make sure they are aware of your progress.
</important_instructions>

{user_message}
"""


async def create_or_get_devin_session(
    github_repo: str, user_message: str, attachment_urls: list[str] | None = None
) -> dict[str, Any]:
    client = DevinClient(VARIABLES.SCRIBE_DEVIN_API_KEY)
    formatted_message = format_message_with_attachments(user_message, attachment_urls or [])
    prompt = create_devin_prompt(github_repo, formatted_message)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            result = await client.create_session(prompt, idempotent=False)
            LOGGER.info(f"[SCRIBE] Created Devin session: {result.get('session_id')}")
            return result
        except httpx.HTTPError as e:
            if attempt == max_retries - 1:
                LOGGER.error(f"[SCRIBE] Failed to create Devin session after {max_retries} attempts: {e}")
                raise
            wait_time = 2**attempt
            LOGGER.warning(f"[SCRIBE] Devin session creation failed (attempt {attempt + 1}), retrying in {wait_time}s")
            await asyncio.sleep(wait_time)

    raise RuntimeError("Failed to create Devin session")


async def send_devin_message(
    session_id: str,
    message: str,
    files: list[dict[str, Any]] | None = None,
    bot_token: str | None = None,
) -> dict[str, Any]:
    client = DevinClient(VARIABLES.SCRIBE_DEVIN_API_KEY)

    attachment_urls: list[str] = []
    if files and bot_token:
        from fai.utils.scribe.slack_file_handler import process_slack_attachments

        attachment_urls = await process_slack_attachments(files, bot_token, client)

    formatted_message = format_message_with_attachments(message, attachment_urls)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            result = await client.send_message(session_id, formatted_message)
            LOGGER.info(f"[SCRIBE] Sent message to Devin session: {session_id}")
            return result
        except httpx.HTTPError as e:
            if attempt == max_retries - 1:
                LOGGER.error(f"[SCRIBE] Failed to send message after {max_retries} attempts: {e}")
                raise
            wait_time = 2**attempt
            LOGGER.warning(f"[SCRIBE] Message send failed (attempt {attempt + 1}), retrying in {wait_time}s")
            await asyncio.sleep(wait_time)

    raise RuntimeError("Failed to send message to Devin session")


async def get_devin_session_status(session_id: str) -> dict[str, Any]:
    client = DevinClient(VARIABLES.SCRIBE_DEVIN_API_KEY)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            result = await client.get_session_status(session_id)
            return result
        except httpx.HTTPError as e:
            if attempt == max_retries - 1:
                LOGGER.error(f"[SCRIBE] Failed to get session status after {max_retries} attempts: {e}")
                raise
            wait_time = 2**attempt
            LOGGER.warning(f"[SCRIBE] Status check failed (attempt {attempt + 1}), retrying in {wait_time}s")
            await asyncio.sleep(wait_time)

    raise RuntimeError("Failed to get Devin session status")
