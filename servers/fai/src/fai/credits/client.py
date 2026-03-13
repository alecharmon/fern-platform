import functools
import os
from typing import Any

import httpx
from fai_ai_core.credits.client import OrgAiCreditClient

from fai.credits.config import get_credit_org_ids
from fai.settings import LOGGER, VARIABLES


async def _resolve_org_id(domain: str) -> str:
    fdr_url = "https://registry.buildwithfern.com/v2/registry/docs/metadata-for-url"
    headers = {
        "Authorization": f"Bearer {VARIABLES.FERN_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.post(fdr_url, headers=headers, json={"url": domain}, timeout=10.0)
        response.raise_for_status()
        metadata: dict[str, Any] = response.json()
        return metadata.get("org", "")


@functools.lru_cache(maxsize=1)
def get_credit_client() -> OrgAiCreditClient | None:
    if not get_credit_org_ids():
        return None

    dashboard_url = os.getenv("DASHBOARD_API_URL")
    jwt_secret = os.getenv("JWT_SECRET_KEY")

    if not dashboard_url or not jwt_secret:
        LOGGER.warning("DASHBOARD_API_URL or JWT_SECRET_KEY not set, credit client disabled")
        return None

    return OrgAiCreditClient(
        dashboard_url=dashboard_url,
        jwt_secret=jwt_secret,
        resolve_org_id=_resolve_org_id,
        logger=LOGGER,
    )


__all__ = ["OrgAiCreditClient", "get_credit_client"]
