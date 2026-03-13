import os
from unittest.mock import patch

from src.credits.config import get_credit_org_ids, is_credit_gated


def test_is_credit_gated_wildcard_matches_any_org() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": "*"}, clear=False):
        get_credit_org_ids.cache_clear()
        assert is_credit_gated("org_123") is True
        assert is_credit_gated("another_org") is True
