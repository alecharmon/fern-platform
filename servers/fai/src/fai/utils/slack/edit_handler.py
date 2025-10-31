import asyncio
import json
import logging

import aioboto3
import httpx
from botocore.exceptions import ClientError
from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.db.slack_editing_session_db import SlackEditingSessionDb
from fai.models.types.editing_session_types import EditingSessionStatus
from fai.settings import (
    CONFIG,
    VARIABLES,
)
from fai.utils.github_utils import get_repo_from_docs_domain

logger = logging.getLogger(__name__)


async def get_or_create_editing_session_for_thread(team_id: str, channel_id: str, thread_ts: str) -> str | None:
    async with async_session_maker() as session:
        result = await session.execute(
            select(SlackEditingSessionDb).where(
                SlackEditingSessionDb.team_id == team_id,
                SlackEditingSessionDb.channel_id == channel_id,
                SlackEditingSessionDb.thread_ts == thread_ts,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Found existing editing session {existing.editing_id} for thread {thread_ts}")
            return existing.editing_id

    return None


async def store_editing_session_for_thread(team_id: str, channel_id: str, thread_ts: str, editing_id: str) -> None:
    async with async_session_maker() as session:
        from datetime import (
            UTC,
            datetime,
        )

        result = await session.execute(
            select(SlackEditingSessionDb).where(
                SlackEditingSessionDb.team_id == team_id,
                SlackEditingSessionDb.channel_id == channel_id,
                SlackEditingSessionDb.thread_ts == thread_ts,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.updated_at = datetime.now(UTC)
            logger.info(f"Updated editing session {editing_id} for thread {thread_ts}")
        else:
            slack_editing = SlackEditingSessionDb(
                team_id=team_id,
                channel_id=channel_id,
                thread_ts=thread_ts,
                editing_id=editing_id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            session.add(slack_editing)
            logger.info(f"Stored new editing session {editing_id} for thread {thread_ts}")

        await session.commit()


async def get_editing_session_status(editing_id: str) -> EditingSessionStatus | None:
    """Get the current status of an editing session."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{CONFIG.FAI_SERVER_URL}/editing-sessions/{editing_id}")

            if response.status_code == 404:
                logger.warning(f"Editing session not found: {editing_id}")
                return None
            elif response.status_code != 200:
                logger.error(f"Failed to fetch editing session: {response.status_code} - {response.text}")
                return None

            session_data = response.json()
            status_str = session_data["editing_session"]["status"]
            return EditingSessionStatus(status_str)

    except Exception as e:
        logger.error(f"Error fetching editing session status: {e}", exc_info=True)
        return None


async def interrupt_editing_session(editing_id: str) -> bool:
    """Interrupt an active editing session. Returns True if successful."""
    try:
        status = await get_editing_session_status(editing_id)

        if status == EditingSessionStatus.STARTUP:
            logger.info(f"Session {editing_id} is in STARTUP state, waiting for it to become ACTIVE")
            max_wait: int = 30
            poll_interval: float = 0.5
            elapsed: float = 0

            while elapsed < max_wait:
                await asyncio.sleep(poll_interval)
                elapsed += poll_interval

                status = await get_editing_session_status(editing_id)
                if status == EditingSessionStatus.ACTIVE:
                    logger.info(f"Session {editing_id} transitioned to ACTIVE, proceeding with interruption")
                    break
                elif status not in [EditingSessionStatus.STARTUP, EditingSessionStatus.ACTIVE]:
                    logger.warning(f"Session {editing_id} in unexpected state {status}, aborting interruption")
                    return False

            if status != EditingSessionStatus.ACTIVE:
                logger.warning(f"Timeout waiting for session {editing_id} to become ACTIVE")
                return False

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{CONFIG.FAI_SERVER_URL}/editing-sessions/{editing_id}/interrupt")

            if response.status_code == 200:
                logger.info(f"Successfully interrupted editing session: {editing_id}")
                return True
            elif response.status_code == 400:
                logger.warning(f"Cannot interrupt session {editing_id} (not in ACTIVE state)")
                return False
            elif response.status_code == 404:
                logger.warning(f"Editing session not found for interruption: {editing_id}")
                return False
            else:
                logger.error(f"Failed to interrupt editing session: {response.status_code} - {response.text}")
                return False

    except Exception as e:
        logger.error(f"Error interrupting editing session: {e}", exc_info=True)
        return False


async def wait_for_interruption(editing_id: str, max_wait_seconds: int = 30, poll_interval: float = 0.5) -> bool:
    """
    Wait for an editing session to transition out of INTERRUPTED status.
    Returns True if session is ready (WAITING), False if timeout or error.
    Polls every poll_interval seconds for up to max_wait_seconds.
    """
    logger.info(f"Waiting for session {editing_id} to complete interruption (max {max_wait_seconds}s)")
    start_time = asyncio.get_event_loop().time()

    while True:
        elapsed = asyncio.get_event_loop().time() - start_time
        if elapsed >= max_wait_seconds:
            logger.warning(f"Timeout waiting for session {editing_id} interruption to complete")
            return False

        status = await get_editing_session_status(editing_id)

        if status is None:
            logger.error(f"Failed to get status for session {editing_id} during interruption wait")
            return False

        if status == EditingSessionStatus.WAITING:
            logger.info(f"Session {editing_id} is now WAITING after interruption")
            return True

        if status in [EditingSessionStatus.INTERRUPTED, EditingSessionStatus.ACTIVE]:
            logger.debug(f"Session {editing_id} still in {status} state, waiting...")
            await asyncio.sleep(poll_interval)
        else:
            logger.warning(f"Unexpected status {status} for session {editing_id} during interruption wait")
            return False


async def create_editing_session(repository: str, base_branch: str = "main") -> str | None:
    """Create a new editing session and return the editing_id."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{CONFIG.FAI_SERVER_URL}/editing-sessions",
                json={
                    "repository": repository,
                    "base_branch": base_branch,
                },
            )

            if response.status_code != 201:
                logger.error(f"Failed to create editing session: {response.status_code} - {response.text}")
                return None

            session_data = response.json()
            editing_id = session_data["editing_session"]["id"]
            logger.info(f"Created new editing session: {editing_id} for repository: {repository}")
            return editing_id

    except Exception as e:
        logger.error(f"Error creating editing session: {e}", exc_info=True)
        return None


async def invoke_editing_lambda(
    prompt: str,
    domain: str,
    base_branch: str = "main",
    editing_id: str | None = None,
    team_id: str | None = None,
    channel_id: str | None = None,
    thread_ts: str | None = None,
) -> dict[str, str] | None:
    if not VARIABLES.FAI_LAMBDA_FUNCTION_NAME:
        logger.warning("FAI_LAMBDA_FUNCTION_NAME not configured. Skipping Lambda invocation.")
        return None

    repository = await get_repo_from_docs_domain(domain)
    if not repository:
        logger.warning(
            f"No GitHub repository found for domain '{domain}'. Skipping Lambda invocation. "
            f"Please ensure the domain is registered in FDR with a connected GitHub repository."
        )
        return None

    logger.info(f"Resolved domain '{domain}' to repository '{repository}'")

    try:
        session = aioboto3.Session()
        async with session.client("lambda") as lambda_client:
            body_payload = {
                "repository": repository,
                "prompt": prompt,
                "base_branch": base_branch,
            }

            if editing_id:
                body_payload["editing_id"] = editing_id
                logger.info(f"Resuming editing session: {editing_id}")

            if team_id and channel_id and thread_ts:
                callback_url = (
                    f"{CONFIG.FAI_SERVER_URL}/scribe/callback/slack/edit/" f"{team_id}/{channel_id}/{thread_ts}"
                )
                body_payload["callback_url"] = callback_url
                logger.info(f"Including callback URL in Lambda invocation: {callback_url}")

            payload = {"body": json.dumps(body_payload)}
            response = await lambda_client.invoke(
                FunctionName=VARIABLES.FAI_LAMBDA_FUNCTION_NAME,
                InvocationType="Event",
                Payload=json.dumps(payload),
            )
            logger.info(
                f"Successfully invoked FAI Lambda for editing. "
                f"StatusCode: {response.get('StatusCode')}, "
                f"Domain: {domain}, "
                f"Repository: {repository}, "
                f"Editing ID: {editing_id or 'new'}"
            )

            return {"status": "invoked", "repository": repository}

    except ClientError as e:
        logger.error(
            f"Failed to invoke FAI Lambda: {e.response['Error']['Code']} - {e.response['Error']['Message']}",
            exc_info=True,
        )
        return None
    except Exception as e:
        logger.error(f"Unexpected error invoking FAI Lambda: {str(e)}", exc_info=True)
        return None
