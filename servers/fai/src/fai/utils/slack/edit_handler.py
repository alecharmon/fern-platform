import json
import logging

import aioboto3
from botocore.exceptions import ClientError
from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.db.slack_editing_session_db import SlackEditingSessionDb
from fai.settings import VARIABLES
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
                    f"https://fai.buildwithfern.com/scribe/callback/slack/edit/" f"{team_id}/{channel_id}/{thread_ts}"
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
