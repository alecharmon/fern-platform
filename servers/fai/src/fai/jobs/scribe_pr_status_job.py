from datetime import (
    UTC,
    datetime,
)

import httpx
import sentry_sdk
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.scribe.pr_qa_logger import log_merged_pr_for_qa


async def check_pr_status(pr_url: str) -> str | None:
    try:
        parts = pr_url.rstrip("/").split("/")
        if len(parts) < 7 or parts[2] != "github.com" or parts[5] != "pull":
            LOGGER.warning(f"[SCRIBE] Invalid PR URL format: {pr_url}")
            return None

        owner = parts[3]
        repo = parts[4]
        pr_number = parts[6]

        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {VARIABLES.FERN_GITHUB_TOKEN}",
                "X-GitHub-Api-Version": "2022-11-28",
            }

            response = await client.get(api_url, headers=headers)
            response.raise_for_status()

            pr_data = response.json()
            state = pr_data.get("state")
            merged = pr_data.get("merged", False)

            if merged:
                return "merged"
            elif state == "closed":
                return "closed"
            else:
                return "open"

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            LOGGER.warning(f"[SCRIBE] PR not found: {pr_url}")
        else:
            sentry_sdk.capture_exception(e, extras={"pr_url": pr_url})
            LOGGER.error(f"[SCRIBE] GitHub API error for {pr_url}: {e}")
        return None
    except Exception as e:
        sentry_sdk.capture_exception(e, extras={"pr_url": pr_url})
        LOGGER.error(f"[SCRIBE] Error checking PR status for {pr_url}: {e}")
        return None


async def check_scribe_pr_statuses(db: AsyncSession) -> dict[str, int]:
    checked_count = 0
    merged_count = 0
    error_count = 0

    try:
        result = await db.execute(
            select(ScribeSessionDb).where(
                ScribeSessionDb.pr_url.isnot(None),
                ScribeSessionDb.pr_status.notin_(["merged", "closed"]),
            )
        )
        sessions = result.scalars().all()

        LOGGER.info(f"[SCRIBE] Checking PR status for {len(sessions)} sessions")

        for session in sessions:
            checked_count += 1
            pr_url = session.pr_url

            if not pr_url:
                continue

            current_status = await check_pr_status(pr_url)

            if current_status is None:
                error_count += 1
                continue

            if current_status != session.pr_status:
                LOGGER.info(
                    f"[SCRIBE] PR status changed for session {session.id}: "
                    f"{session.pr_status} -> {current_status} ({pr_url})"
                )

                session.pr_status = current_status
                session.updated_at = datetime.now(UTC)

                if current_status in ["merged", "closed"]:
                    if current_status == "merged":
                        merged_count += 1
                    try:
                        await log_merged_pr_for_qa(session, current_status)
                    except Exception as e:
                        sentry_sdk.capture_exception(
                            e, extras={"session_id": session.id, "pr_url": pr_url, "status": current_status}
                        )
                        LOGGER.error(f"[SCRIBE] Failed to log PR status for session {session.id}: {e}")

        await db.commit()

        return {
            "checked": checked_count,
            "merged": merged_count,
            "errors": error_count,
        }

    except Exception as e:
        sentry_sdk.capture_exception(
            e, extras={"checked": checked_count, "merged": merged_count, "errors": error_count}
        )
        LOGGER.exception(f"[SCRIBE] Error in PR status check job: {e}")
        return {
            "checked": checked_count,
            "merged": merged_count,
            "errors": error_count + 1,
        }
