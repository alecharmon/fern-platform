import json
from collections.abc import AsyncGenerator
from urllib.parse import urlparse

import sentry_sdk
from fastapi import (
    HTTPException,
    Request,
    status,
)
from fern.core import ApiError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from upstash_redis.asyncio import Redis

from fai.db import async_session_maker
from fai.models.db.settings_db import SettingsDb
from fai.settings import (
    LOGGER,
    VARIABLES,
)
from fai.utils.get_venus_client import get_venus_client

redis = Redis(url=VARIABLES.KV_REST_API_URL, token=VARIABLES.KV_REST_API_READ_ONLY_TOKEN)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


def _get_bearer_token_or_raise(request: Request) -> str:
    """Extract and validate the bearer token from the Authorization header.

    Args:
        request: The FastAPI request object

    Returns:
        The extracted bearer token

    Raises:
        HTTPException: If the token is missing or invalid format
    """
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")

    return auth_header[7:]


async def verify_org_token(request: Request) -> str:
    """Verify that the request has a valid bearer token by checking with Venus.

    This is a simpler version of verify_token that doesn't require a domain parameter.
    Use this for endpoints that don't operate on domain-specific resources.
    """
    token = _get_bearer_token_or_raise(request)
    venus_client = get_venus_client(token=token)

    try:
        orgs = await venus_client.organization.get_org_ids_from_token()
    except ApiError as e:
        # Venus API errors - forward auth errors as 401, others as 500
        raise HTTPException(
            status_code=e.status_code,
            detail=e.body,
        )
    except Exception as e:
        # Unexpected errors should be 500
        LOGGER.exception("Unexpected error verifying token with Venus", exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )

    if not orgs:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of any organizations")
    return token


async def verify_token(request: Request, domain: str) -> str:
    token = _get_bearer_token_or_raise(request)
    venus_client = get_venus_client(token=token)

    try:
        domain_metadata = await redis.hget(domain, "metadata")
        domain_metadata = json.loads(domain_metadata)
        org_name = domain_metadata.get("org", None)
        if await venus_client.organization.is_member(org_name):
            return token
    except Exception:
        LOGGER.warning(f"Domain metadata not found for {domain}")

    orgs = await venus_client.organization.get_org_ids_from_token()
    is_fern_member = "fern" in orgs

    if not is_fern_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this organization")

    return token


async def ask_ai_enabled(domain: str) -> None:
    domain = strip_domain(domain)
    async with async_session_maker() as session:
        existing = await session.execute(select(SettingsDb).where(SettingsDb.domain == domain))
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            try:
                org_id = await resolve_org_id(domain)
                new_record = SettingsDb(
                    domain=domain,
                    org_name=org_id,
                    job_id=None,
                    last_reindex_time=None,
                    docs_enabled=True,
                )
                session.add(new_record)
                await session.commit()
                LOGGER.info(f"Auto-provisioned AI settings for domain {domain}")

                from fai.routes.settings import queue_reindex_sqs

                try:
                    await queue_reindex_sqs(domain)
                    LOGGER.info(f"Auto-triggered reindex for domain {domain}")
                except Exception as reindex_err:
                    sentry_sdk.capture_exception(reindex_err)
                    LOGGER.error(f"Failed to auto-trigger reindex for domain {domain}: {reindex_err}")
            except Exception as e:
                sentry_sdk.capture_exception(e)
                LOGGER.error(f"Failed to auto-provision AI settings for domain {domain}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to auto-provision AI settings",
                )
            return

        if not existing_record.docs_enabled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ask AI is not enabled for this domain")


async def resolve_org_id(domain: str) -> str | None:
    try:
        domain_metadata = await redis.hget(domain, "metadata")
        if domain_metadata:
            parsed = json.loads(domain_metadata)
            return parsed.get("org")
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.warning(f"Failed to resolve org_id for domain {domain}")
    return None


def strip_domain(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    return parsed.netloc
