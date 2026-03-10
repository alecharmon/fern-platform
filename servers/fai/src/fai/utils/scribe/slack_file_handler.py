from dataclasses import dataclass, field
from typing import Any

import httpx
import sentry_sdk

from fai.settings import LOGGER
from fai.utils.scribe.devin_client import DevinClient


@dataclass
class AttachmentResult:
    urls: list[str] = field(default_factory=list)
    failed_filenames: list[str] = field(default_factory=list)


async def download_slack_file(file_url: str, bot_token: str) -> bytes:
    async with httpx.AsyncClient(follow_redirects=True) as client:
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
) -> AttachmentResult:
    result = AttachmentResult()

    for file_info in files:
        file_url = file_info.get("url_private")
        filename = file_info.get("name", "attachment")

        if not file_url:
            LOGGER.warning(f"[SCRIBE] File {filename} has no url_private, skipping")
            result.failed_filenames.append(filename)
            continue

        try:
            file_content = await download_slack_file(file_url, bot_token)
            devin_url = await devin_client.upload_attachment(file_content, filename)
            result.urls.append(devin_url)
            LOGGER.info(f"[SCRIBE] Uploaded {filename} to Devin: {devin_url}")
        except Exception as e:
            sentry_sdk.capture_exception(e, extras={"filename": filename, "file_url": file_url})
            LOGGER.error(f"[SCRIBE] Failed to process attachment {filename}: {e}")
            result.failed_filenames.append(filename)

    return result
