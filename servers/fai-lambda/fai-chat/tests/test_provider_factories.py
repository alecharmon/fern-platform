import os
from unittest.mock import patch

import pytest

from src.llm.anthropic import AnthropicProvider
from src.llm.anthropic_factory import AnthropicProviderFactory
from src.llm.bedrock import BedrockProvider
from src.llm.bedrock_factory import BedrockProviderFactory


class TestBedrockProviderFactory:
    @patch.dict(os.environ, {"AWS_ACCESS_KEY_ID": "test-key", "AWS_SECRET_ACCESS_KEY": "test-secret"})
    def test_is_available_with_credentials(self) -> None:
        factory = BedrockProviderFactory()
        assert factory.is_available()

    @patch.dict(os.environ, {}, clear=True)
    def test_is_available_without_credentials(self) -> None:
        factory = BedrockProviderFactory()
        assert not factory.is_available()

    @patch.dict(os.environ, {"AWS_ACCESS_KEY_ID": "test-key", "AWS_SECRET_ACCESS_KEY": "test-secret"})
    def test_create_valid_model(self) -> None:
        factory = BedrockProviderFactory()
        provider = factory.create(model="claude-3.7", temperature=0.5, max_tokens=1000)
        assert provider is not None
        assert isinstance(provider, BedrockProvider)

    @patch.dict(os.environ, {"AWS_ACCESS_KEY_ID": "test-key", "AWS_SECRET_ACCESS_KEY": "test-secret"})
    def test_create_invalid_model_returns_none(self) -> None:
        factory = BedrockProviderFactory()
        provider = factory.create(model="invalid-model")
        assert provider is None

    @patch.dict(os.environ, {}, clear=True)
    def test_create_without_credentials_raises_error(self) -> None:
        factory = BedrockProviderFactory()
        with pytest.raises(ValueError, match="Bedrock provider requires AWS credentials"):
            factory.create(model="claude-3.7")

    @patch.dict(os.environ, {"AWS_ACCESS_KEY_ID": "test-key", "AWS_SECRET_ACCESS_KEY": "test-secret"})
    def test_get_supported_models(self) -> None:
        factory = BedrockProviderFactory()
        models = factory.get_supported_models()
        assert "claude-3.7" in models
        assert "claude-4" in models
        assert "claude-4.5" in models
        assert "claude-4.5-haiku" in models
        assert all(isinstance(v, str) for v in models.values())

    @patch.dict(os.environ, {"AWS_ACCESS_KEY_ID": "test-key", "AWS_SECRET_ACCESS_KEY": "test-secret"})
    def test_provider_name(self) -> None:
        factory = BedrockProviderFactory()
        assert factory.provider_name == "bedrock"


class TestAnthropicProviderFactory:
    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
    def test_is_available_with_credentials(self) -> None:
        factory = AnthropicProviderFactory()
        assert factory.is_available()

    @patch.dict(os.environ, {}, clear=True)
    def test_is_available_without_credentials(self) -> None:
        factory = AnthropicProviderFactory()
        assert not factory.is_available()

    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
    def test_create_valid_model(self) -> None:
        factory = AnthropicProviderFactory()
        provider = factory.create(model="claude-4", temperature=0.5, max_tokens=1000)
        assert provider is not None
        assert isinstance(provider, AnthropicProvider)

    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
    def test_create_invalid_model_returns_none(self) -> None:
        factory = AnthropicProviderFactory()
        provider = factory.create(model="claude-3.7")
        assert provider is None

    @patch.dict(os.environ, {}, clear=True)
    def test_create_without_credentials_raises_error(self) -> None:
        factory = AnthropicProviderFactory()
        with pytest.raises(ValueError, match="Anthropic provider requires API key"):
            factory.create(model="claude-4")

    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
    def test_get_supported_models(self) -> None:
        factory = AnthropicProviderFactory()
        models = factory.get_supported_models()
        assert "claude-4" in models
        assert "claude-4.5" in models
        assert "claude-4.5-haiku" in models
        assert "claude-3.7" not in models
        assert all(isinstance(v, str) for v in models.values())

    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
    def test_provider_name(self) -> None:
        factory = AnthropicProviderFactory()
        assert factory.provider_name == "anthropic"
