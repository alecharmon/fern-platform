import functools
import logging
import os

from fai_ai_core.credits.client import OrgAiCreditClient

from src.clients.fdr_client import get_fdr_client
from src.credits.config import get_credit_org_ids

logger = logging.getLogger(__name__)


async def _resolve_org_id(domain: str) -> str:
    fdr_client = get_fdr_client()
    response = await fdr_client.docs.v_2.read.get_docs_url_metadata(url=domain)
    return getattr(response, "org", "")


@functools.lru_cache(maxsize=1)
def get_credit_client() -> OrgAiCreditClient | None:
    if not get_credit_org_ids():
        return None

    dashboard_url = os.getenv("DASHBOARD_API_URL")
    jwt_secret = os.getenv("JWT_SECRET_KEY")

    if not dashboard_url or not jwt_secret:
        logger.warning("DASHBOARD_API_URL or JWT_SECRET_KEY not set, credit client disabled")
        return None

    return OrgAiCreditClient(
        dashboard_url=dashboard_url,
        jwt_secret=jwt_secret,
        resolve_org_id=_resolve_org_id,
        logger=logger,
    )


__all__ = ["OrgAiCreditClient", "get_credit_client"]
