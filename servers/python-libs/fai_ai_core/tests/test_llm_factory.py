import os
from unittest.mock import patch

import pytest

from fai_ai_core.llm.anthropic_factory import ANTHROPIC_MODEL_CONFIGS
from fai_ai_core.llm.bedrock_factory import BEDROCK_MODEL_CONFIGS
from fai_ai_core.llm.factory import (
    _build_ordered_models,
    _create_llm_provider,
    _resolve_model_id,
)
from fai_ai_core.llm.fallback import FallbackProvider


class TestModelResolution:
    def test_resolve_valid_model(self) -> None:
        result = _resolve_model_id("claude-4-sonnet")
        assert result == "claude-4-sonnet"

    def test_resolve_invalid_model_returns_default(self) -> None:
        result = _resolve_model_id("invalid-model")
        assert result == "claude-3.7"

    def test_resolve_none_returns_default(self) -> None:
        result = _resolve_model_id(None)
        assert result == "claude-3.7"


class TestFallbackOrder:
    def test_build_ordered_models_claude_4(self) -> None:
        result = _build_ordered_models("claude-4-sonnet")
        assert result[0] == "claude-4-sonnet"
        assert "claude-4.5-haiku" in result
        assert "claude-4.5-sonnet" in result
        assert len(result) == 3

    def test_build_ordered_models_claude_3_7(self) -> None:
        result = _build_ordered_models("claude-3.7")
        assert result[0] == "claude-3.7"
        assert result[1] == "claude-4-sonnet"
        assert result[2] == "claude-4.5-haiku"
        assert result[3] == "claude-4.5-sonnet"

    def test_no_duplicate_models(self) -> None:
        result = _build_ordered_models("claude-4.5-haiku")
        assert len(result) == len(set(result))


class TestProviderCreation:
    @patch.dict(os.environ, {"AWS_ACCESS_KEY_ID": "test", "AWS_SECRET_ACCESS_KEY": "test"})
    def test_create_bedrock_only(self) -> None:
        provider = _create_llm_provider(
            model="claude-3.7",
            provider_preference=["bedrock"],
        )
        assert isinstance(provider, FallbackProvider)

    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
    def test_create_anthropic_only(self) -> None:
        provider = _create_llm_provider(
            model="claude-4.5-haiku",
            provider_preference=["anthropic"],
        )
        assert isinstance(provider, FallbackProvider)

    @patch.dict(
        os.environ,
        {
            "AWS_ACCESS_KEY_ID": "test",
            "AWS_SECRET_ACCESS_KEY": "test",
            "ANTHROPIC_API_KEY": "test-key",
        },
    )
    def test_create_with_both_providers(self) -> None:
        provider = _create_llm_provider(model="claude-4-sonnet")
        assert isinstance(provider, FallbackProvider)

    def test_no_api_keys_raises_error(self) -> None:
        with patch.dict(
            os.environ,
            {
                "AWS_ACCESS_KEY_ID": "",
                "AWS_SECRET_ACCESS_KEY": "",
                "ANTHROPIC_API_KEY": "",
            },
            clear=True,
        ):
            with pytest.raises(ValueError, match="No providers configured"):
                _create_llm_provider()


class TestModelConfigs:
    def test_bedrock_has_all_models(self) -> None:
        assert "claude-3.7" in BEDROCK_MODEL_CONFIGS
        assert "claude-4-sonnet" in BEDROCK_MODEL_CONFIGS
        assert "claude-4.5-sonnet" in BEDROCK_MODEL_CONFIGS
        assert "claude-4.5-haiku" in BEDROCK_MODEL_CONFIGS

    def test_anthropic_missing_claude_37(self) -> None:
        assert "claude-3.7" not in ANTHROPIC_MODEL_CONFIGS
        assert "claude-4-sonnet" in ANTHROPIC_MODEL_CONFIGS
        assert "claude-4.5-sonnet" in ANTHROPIC_MODEL_CONFIGS

    def test_bedrock_configs_have_region(self) -> None:
        for config in BEDROCK_MODEL_CONFIGS.values():
            assert "region" in config
            assert "model_id" in config

    def test_anthropic_configs_have_model_id(self) -> None:
        for config in ANTHROPIC_MODEL_CONFIGS.values():
            assert "model_id" in config
