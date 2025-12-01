import hashlib
import hmac
import time
from datetime import (
    UTC,
    datetime,
    timedelta,
)
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from fai.db import async_session_maker
from fai.dependencies import strip_domain
from fai.settings import LOGGER

MESSAGE_CACHE_TTL = 600
SLACK_SCOPES = [
    "app_mentions:read",
    "channels:history",
    "channels:join",
    "channels:read",
    "chat:write",
    "commands",
    "groups:history",
    "im:history",
    "mpim:history",
    "reactions:read",
    "reactions:write",
    "users:read",
    "users:read.email",
]


def verify_slack_signature(request_body: bytes, timestamp: str, signature: str, signing_secret: str) -> bool:
    if abs(time.time() - float(timestamp)) > 60 * 5:
        return False

    sig_basestring = f"v0:{timestamp}:{request_body.decode('utf-8')}"

    my_signature = "v0=" + hmac.new(signing_secret.encode(), sig_basestring.encode(), hashlib.sha256).hexdigest()

    return hmac.compare_digest(my_signature, signature)


def create_slack_integration_url(integration_id: str, client_id: str) -> str:
    scope_string = ",".join(SLACK_SCOPES)
    return (
        f"https://slack.com/oauth/v2/authorize?"
        f"client_id={client_id}&"
        f"scope={quote(scope_string)}&"
        f"state={integration_id}"
    )


async def cleanup_message_cache(cache_db_model: Any) -> None:
    cutoff_time = datetime.now(UTC) - timedelta(seconds=MESSAGE_CACHE_TTL)

    async with async_session_maker() as session:
        await session.execute(delete(cache_db_model).where(cache_db_model.processed_at < cutoff_time))
        await session.commit()


async def is_message_processed(team_id: str, message_ts: str, cache_db_model: Any) -> bool:
    async with async_session_maker() as session:
        result = await session.execute(
            select(cache_db_model).where(cache_db_model.team_id == team_id, cache_db_model.message_ts == message_ts)
        )
        return result.scalar_one_or_none() is not None


async def mark_message_processed(team_id: str, message_ts: str, cache_db_model: Any, unique_constraint: str) -> None:
    async with async_session_maker() as session:
        stmt = insert(cache_db_model).values(
            id=str(uuid4()), message_ts=message_ts, team_id=team_id, processed_at=datetime.now(UTC)
        )
        stmt = stmt.on_conflict_do_nothing(constraint=unique_constraint)
        await session.execute(stmt)
        await session.commit()


async def create_integration(
    domain: str, db: AsyncSession, integration_db_model: Any, client_id: str, log_prefix: str
) -> dict[str, Any]:
    try:
        stripped_domain = strip_domain(domain)

        existing = await db.execute(select(integration_db_model).where(integration_db_model.domain == stripped_domain))
        existing_record = existing.scalar_one_or_none()
        if existing_record:
            integration_url = create_slack_integration_url(existing_record.integration_id, client_id)
            return {
                "integration_id": existing_record.integration_id,
                "domain": existing_record.domain,
                "slack_team_id": existing_record.slack_team_id,
                "slack_team_name": existing_record.slack_team_name,
                "created_at": existing_record.created_at,
                "installed_at": existing_record.installed_at,
                "integration_url": integration_url,
            }

        new_integration = integration_db_model(domain=stripped_domain, created_at=datetime.now(UTC))
        db.add(new_integration)
        await db.commit()
        await db.refresh(new_integration)

        integration_url = create_slack_integration_url(new_integration.integration_id, client_id)
        return {
            "integration_id": new_integration.integration_id,
            "domain": new_integration.domain,
            "slack_team_id": new_integration.slack_team_id,
            "slack_team_name": new_integration.slack_team_name,
            "created_at": new_integration.created_at,
            "installed_at": new_integration.installed_at,
            "integration_url": integration_url,
        }

    except Exception as e:
        LOGGER.error(f"{log_prefix} Failed to create Slack integration: {e}")
        raise HTTPException(status_code=500, detail="Failed to create integration")


async def handle_oauth_callback(
    code: str,
    state: str | None,
    integration_db_model: Any,
    client_id: str,
    client_secret: str,
    log_prefix: str,
) -> JSONResponse:
    try:
        LOGGER.info(f"{log_prefix} Received OAuth callback with code: {code[:10]}... and state: {state}")

        if not state:
            raise HTTPException(status_code=400, detail="Missing integration_id in state parameter")

        async with async_session_maker() as session:
            result = await session.execute(
                select(integration_db_model).where(integration_db_model.integration_id == state)
            )
            integration = result.scalar_one_or_none()

            if not integration:
                raise HTTPException(status_code=404, detail="Invalid integration_id")

            client = AsyncWebClient()
            oauth_response = await client.oauth_v2_access(
                client_id=client_id,
                client_secret=client_secret,
                code=code,
            )

            if not oauth_response.get("ok"):
                LOGGER.error(f"{log_prefix} OAuth exchange error: {oauth_response.get('error')}")
                raise HTTPException(status_code=500, detail=oauth_response.get("error", "OAuth failed"))

            team_id = oauth_response.get("team", {}).get("id")

            if team_id:
                existing_team_result = await session.execute(
                    select(integration_db_model).where(
                        integration_db_model.slack_team_id == team_id, integration_db_model.integration_id != state
                    )
                )
                existing_team_integration = existing_team_result.scalar_one_or_none()

                if existing_team_integration:
                    old_integration_id = existing_team_integration.integration_id
                    LOGGER.info(f"{log_prefix} Removing team {team_id} from old integration {old_integration_id}")
                    existing_team_integration.slack_team_id = None
                    existing_team_integration.slack_team_name = None
                    existing_team_integration.slack_bot_token = None
                    existing_team_integration.slack_bot_user_id = None
                    existing_team_integration.slack_app_id = None
                    existing_team_integration.installed_at = None
                    await session.flush()

            integration.slack_team_id = team_id
            integration.slack_team_name = oauth_response.get("team", {}).get("name")
            integration.slack_bot_token = oauth_response.get("access_token")
            integration.slack_bot_user_id = oauth_response.get("bot_user_id")
            integration.slack_app_id = oauth_response.get("app_id")
            integration.installed_at = datetime.now(UTC)

            await session.commit()

            LOGGER.info(f"{log_prefix} Successfully installed Slack app for team: {integration.slack_team_id}")

        return JSONResponse(
            content={
                "status": "success",
                "message": f"{log_prefix.strip('[]')} Slack app successfully installed",
                "team_id": integration.slack_team_id,
                "domain": integration.domain,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.error(f"{log_prefix} Error handling Slack OAuth callback: {e}")
        raise HTTPException(status_code=500, detail="OAuth callback failed")
