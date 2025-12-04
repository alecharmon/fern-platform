from typing import Any

import httpx

from fai.settings import LOGGER
from fai.utils.scribe.devin_client import DevinClient


async def download_slack_file(file_url: str, bot_token: str) -> bytes:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            file_url,
            headers={"Authorization": f"Bearer {bot_token}"},
            timeout=60.0,
        )
        response.raise_for_status()
        return response.content


async def process_slack_attachments(
    files: list[dict[str, Any]],
    bot_token: str,
    devin_client: DevinClient,
) -> list[str]:
    attachment_urls = []

    for file_info in files:
        file_url = file_info.get("url_private")
        filename = file_info.get("name", "attachment")
        mimetype = file_info.get("mimetype", "")

        if not file_url:
            LOGGER.warning(f"[SCRIBE] File {filename} has no url_private, skipping")
            continue

        if not mimetype.startswith("image/"):
            LOGGER.warning(f"[SCRIBE] Skipping non-image file: {filename} ({mimetype})")
            continue

        try:
            file_content = await download_slack_file(file_url, bot_token)
            devin_url = await devin_client.upload_attachment(file_content, filename)
            attachment_urls.append(devin_url)
            LOGGER.info(f"[SCRIBE] Uploaded {filename} to Devin: {devin_url}")
        except Exception as e:
            LOGGER.error(f"[SCRIBE] Failed to process attachment {filename}: {e}")

    return attachment_urls
