import os
from unittest.mock import patch

from fai.credits.config import get_credit_org_ids, is_credit_gated


def test_empty_env_returns_empty_set() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": ""}, clear=False):
        get_credit_org_ids.cache_clear()
        assert get_credit_org_ids() == frozenset()


def test_single_org_id() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": "org_123"}, clear=False):
        get_credit_org_ids.cache_clear()
        assert get_credit_org_ids() == frozenset({"org_123"})


def test_multiple_org_ids() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": "org_1,org_2,org_3"}, clear=False):
        get_credit_org_ids.cache_clear()
        assert get_credit_org_ids() == frozenset({"org_1", "org_2", "org_3"})


def test_whitespace_trimmed() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": " org_1 , org_2 "}, clear=False):
        get_credit_org_ids.cache_clear()
        assert get_credit_org_ids() == frozenset({"org_1", "org_2"})


def test_missing_env_returns_empty_set() -> None:
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("ORG_AI_CREDIT_CHECK_ORG_IDS", None)
        get_credit_org_ids.cache_clear()
        assert get_credit_org_ids() == frozenset()


def test_is_credit_gated_true() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": "org_123,org_456"}, clear=False):
        get_credit_org_ids.cache_clear()
        assert is_credit_gated("org_123") is True


def test_is_credit_gated_false() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": "org_123"}, clear=False):
        get_credit_org_ids.cache_clear()
        assert is_credit_gated("org_999") is False


def test_is_credit_gated_empty_env() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": ""}, clear=False):
        get_credit_org_ids.cache_clear()
        assert is_credit_gated("org_123") is False


def test_is_credit_gated_wildcard_matches_any_org() -> None:
    with patch.dict(os.environ, {"ORG_AI_CREDIT_CHECK_ORG_IDS": "*"}, clear=False):
        get_credit_org_ids.cache_clear()
        assert is_credit_gated("org_123") is True
        assert is_credit_gated("another_org") is True
