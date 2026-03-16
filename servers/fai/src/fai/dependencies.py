import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx
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

# Middleware KV — separate Upstash instance where basepath-routes live.
# Falls back to the main KV if MWARE env vars are not set.
_mware_kv_url = VARIABLES.MWARE_KV_REST_API_URL or VARIABLES.KV_REST_API_URL
_mware_kv_token = VARIABLES.MWARE_KV_REST_API_TOKEN or VARIABLES.KV_REST_API_READ_ONLY_TOKEN
_using_mware_kv = bool(VARIABLES.MWARE_KV_REST_API_URL)
if _using_mware_kv:
    LOGGER.info(f"mware_redis: using dedicated middleware KV ({_mware_kv_url[:40]}...)")
else:
    _mware_missing_msg = (
        "mware_redis: MWARE_KV_REST_API_URL is not set or empty"
        " — falling back to main KV. is_basepath_aware() will always return False."
    )
    LOGGER.error(_mware_missing_msg)
    sentry_sdk.capture_message(_mware_missing_msg, level="error")
mware_redis = Redis(url=_mware_kv_url, token=_mware_kv_token)


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
    stripped_domain, basepath = parse_domain_and_basepath(domain)

    # If a basepath was parsed, check upstash to verify the domain is actually
    # basepath-aware. If not, strip the basepath to avoid spurious auto-provisioning.
    if basepath:
        if not await is_basepath_aware(stripped_domain):
            LOGGER.info(f"Domain {stripped_domain} is not basepath-aware, ignoring parsed basepath={basepath}")
            basepath = ""

    async with async_session_maker() as session:
        query = select(SettingsDb).where(
            SettingsDb.domain == stripped_domain,
            SettingsDb.basepath == basepath,
        )
        existing = await session.execute(query)
        existing_record = existing.scalar_one_or_none()

        if not existing_record:
            try:
                meta = await resolve_domain_metadata(stripped_domain)

                if meta.is_preview:
                    LOGGER.info(f"Skipping auto-provision for preview domain {stripped_domain}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Ask AI is not enabled for preview domains",
                    )

                new_record = SettingsDb(
                    domain=stripped_domain,
                    basepath=basepath,
                    org_name=meta.org_id,
                    last_reindex_time=None,
                    docs_enabled=True,
                )
                session.add(new_record)
                await session.commit()
                LOGGER.info(f"Auto-provisioned AI settings for domain {stripped_domain}, basepath={basepath}")

                from fai.routes.settings import queue_reindex_sqs

                try:
                    await queue_reindex_sqs(stripped_domain, db=session, basepath=basepath)
                    LOGGER.info(f"Auto-triggered reindex for domain {stripped_domain}, basepath={basepath}")
                except Exception as reindex_err:
                    sentry_sdk.capture_exception(reindex_err)
                    LOGGER.error(f"Failed to auto-trigger reindex for domain {stripped_domain}: {reindex_err}")
            except HTTPException:
                raise
            except Exception as e:
                sentry_sdk.capture_exception(e)
                LOGGER.error(f"Failed to auto-provision AI settings for domain {stripped_domain}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to auto-provision AI settings",
                )
            return

        if not existing_record.docs_enabled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ask AI is not enabled for this domain")


@dataclass
class DomainMetadata:
    org_id: str | None = None
    is_preview: bool = False


async def resolve_domain_metadata(domain: str) -> DomainMetadata:
    """Resolve org_id and preview status for a domain.

    Tries Redis first, then falls back to the FDR metadata API.
    """
    # Try Redis first (fastest)
    try:
        domain_metadata = await redis.hget(domain, "metadata")
        if domain_metadata:
            parsed = json.loads(domain_metadata)
            org = parsed.get("org")
            is_preview = parsed.get("isPreviewUrl", False)
            if org:
                return DomainMetadata(org_id=org, is_preview=is_preview)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.warning(f"Failed to resolve domain metadata from Redis for domain {domain}")

    # Fall back to FDR metadata API
    try:
        fdr_url = f"{VARIABLES.FDR_REGISTRY_URL}/v2/registry/docs/metadata-for-url"
        headers = {
            "Authorization": f"Bearer {VARIABLES.FERN_TOKEN}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.post(fdr_url, headers=headers, json={"url": domain}, timeout=10.0)
            response.raise_for_status()
            metadata: dict[str, Any] = response.json()
            org = metadata.get("org")
            is_preview = metadata.get("isPreviewUrl", False)
            if org:
                LOGGER.info(
                    f"Resolved domain metadata from FDR for domain {domain}: org={org}, is_preview={is_preview}"
                )
            return DomainMetadata(org_id=org, is_preview=is_preview)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.warning(f"Failed to resolve domain metadata from FDR for domain {domain}: {e}")

    return DomainMetadata()


async def resolve_org_id(domain: str) -> str | None:
    """Resolve only the org_id for a domain. Convenience wrapper around resolve_domain_metadata."""
    meta = await resolve_domain_metadata(domain)
    return meta.org_id


def strip_domain(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    return parsed.netloc


BASEPATH_ROUTES_KEY_PREFIX = "basepath-routes"


async def is_basepath_aware(domain: str) -> bool:
    """Check upstash to see if a domain has registered basepath routes.

    Returns True if the domain has basepath routes in upstash, False otherwise.
    """
    try:
        key = f"{BASEPATH_ROUTES_KEY_PREFIX}:{domain}"
        LOGGER.info(f"is_basepath_aware: querying key={key}, using_mware_kv={_using_mware_kv}")
        basepaths = await mware_redis.hkeys(key)
        result = len(basepaths) > 0
        LOGGER.info(f"is_basepath_aware: domain={domain}, basepaths={basepaths}, result={result}")
        return result
    except Exception as e:
        sentry_sdk.capture_exception(e)
        LOGGER.warning(f"is_basepath_aware: FAILED for domain {domain}: {e}")
        return False


def parse_domain_and_basepath(url: str) -> tuple[str, str]:
    """Extract the domain (netloc) and basepath from a URL or domain string.

    Returns (domain, basepath) where basepath is '' if not present.
    """
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    domain = parsed.netloc
    basepath = parsed.path.rstrip("/") or ""
    return domain, basepath
