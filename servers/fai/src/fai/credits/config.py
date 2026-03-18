import functools
import os

WILDCARD_ORG_ID = "*"
ACCU_TO_CREDITS_RATIO = int(os.getenv("ACCU_TO_CREDITS_RATIO", "1"))


@functools.lru_cache(maxsize=1)
def get_credit_org_ids() -> frozenset[str]:
    raw = os.getenv("ORG_AI_CREDIT_CHECK_ORG_IDS", "")
    return frozenset(id.strip() for id in raw.split(",") if id.strip())


def is_credit_gated(org_id: str) -> bool:
    credit_org_ids = get_credit_org_ids()
    return WILDCARD_ORG_ID in credit_org_ids or org_id in credit_org_ids
