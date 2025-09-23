import json
from collections.abc import AsyncGenerator

from fastapi import (
    HTTPException,
    Request,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from upstash_redis import Redis

from src.fai.db import async_session_maker
from src.fai.utils.get_venus_client import get_venus_client
from src.settings import VARIABLES

redis = Redis(url=VARIABLES.KV_REST_API_URL, token=VARIABLES.KV_REST_API_READ_ONLY_TOKEN)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def verify_token(request: Request, domain: str) -> str:
    """Verify user is a Fern admin or belongs to the organization owning `domain`."""

    print(f"Verifying token for domain {domain}")

    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")

    token = auth_header[7:]

    venus_client = get_venus_client(token=token)

    try:
        domain_metadata = redis.hget(domain, "metadata")
        domain_metadata = json.loads(domain_metadata)
        org_name = domain_metadata.get("org", None)
        if venus_client.organization.is_member(org_name):
            return token
    except Exception:
        print(f"Domain metadata not found for {domain}")
        print("Falling back to Venus auth check")

    orgs = venus_client.organization.get_org_ids_from_token()
    is_fern_member = "fern" in orgs

    if not is_fern_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this organization")

    return token
