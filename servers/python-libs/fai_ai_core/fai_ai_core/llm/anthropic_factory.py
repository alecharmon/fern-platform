"""Anthropic provider factory."""

import os

from .anthropic import AnthropicProvider
from .models import ModelId
from .provider_factory import ProviderFactory

ANTHROPIC_MODEL_CONFIGS: dict[ModelId, dict[str, str]] = {
    "claude-4-sonnet": {"model_id": "claude-sonnet-4-20250514"},
    "claude-4.5-sonnet": {"model_id": "claude-sonnet-4-5-20250929"},
    "claude-4.5-haiku": {"model_id": "claude-haiku-4-5-20251001"},
}


class AnthropicProviderFactory(ProviderFactory):
    def __init__(self) -> None:
        self._api_key = os.environ.get("ANTHROPIC_API_KEY")

    def create(
        self,
        model: str,
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> AnthropicProvider | None:
        if model not in ANTHROPIC_MODEL_CONFIGS:
            return None

        if not self._api_key:
            raise ValueError("Anthropic provider requires API key")

        config = ANTHROPIC_MODEL_CONFIGS[model]  # type: ignore
        return AnthropicProvider(
            model_id=config["model_id"],
            api_key=self._api_key,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    def is_available(self) -> bool:
        return bool(self._api_key)

    def get_supported_models(self) -> dict[str, str]:
        return {alias: config["model_id"] for alias, config in ANTHROPIC_MODEL_CONFIGS.items()}

    @property
    def provider_name(self) -> str:
        return "anthropic"
