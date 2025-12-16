import asyncio

from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.settings import LOGGER
from fai.utils.scribe.db_helpers import get_scribe_integration_by_id
from fai.utils.scribe.session_poller import poll_devin_session


async def resume_active_sessions() -> None:
    LOGGER.info("[SCRIBE] Checking for active Devin sessions to resume polling...")

    async with async_session_maker() as session:
        result = await session.execute(
            select(ScribeSessionDb).where(ScribeSessionDb.status.notin_(["blocked", "stopped"]))
        )
        active_sessions = result.scalars().all()

    if not active_sessions:
        LOGGER.info("[SCRIBE] No active sessions found to resume")
        return

    LOGGER.info(f"[SCRIBE] Found {len(active_sessions)} active session(s) to resume polling")

    for session_record in active_sessions:
        integration = await get_scribe_integration_by_id(session_record.integration_id)

        if not integration or not integration.slack_bot_token:
            LOGGER.warning(
                f"[SCRIBE] Cannot resume session {session_record.devin_session_id}: " "missing integration or bot token"
            )
            continue

        LOGGER.info(f"[SCRIBE] Resuming polling for session {session_record.devin_session_id}")
        asyncio.create_task(
            poll_devin_session(
                session_record.id,
                session_record.devin_session_id,
                session_record.slack_channel,
                session_record.slack_thread_ts,
                integration.slack_bot_token,
            )
        )
