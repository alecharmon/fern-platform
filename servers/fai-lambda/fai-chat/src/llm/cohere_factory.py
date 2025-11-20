"""Cohere provider factory."""

import os

from .cohere import CohereProvider
from .models import ModelId
from .provider_factory import ProviderFactory

COHERE_MODEL_CONFIGS: dict[ModelId, dict[str, str]] = {
    "command-a-03-2025": {"model_id": "command-a-03-2025"},
}


class CohereProviderFactory(ProviderFactory):
    def __init__(self) -> None:
        self._api_key = os.environ.get("COHERE_API_KEY")

    def create(
        self,
        model: str,
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> CohereProvider | None:
        if model not in COHERE_MODEL_CONFIGS:
            return None

        if not self._api_key:
            raise ValueError("Cohere provider requires API key")

        config = COHERE_MODEL_CONFIGS[model]  # type: ignore
        return CohereProvider(
            model_id=config["model_id"],
            api_key=self._api_key,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    def is_available(self) -> bool:
        return bool(self._api_key)

    def get_supported_models(self) -> dict[str, str]:
        return {alias: config["model_id"] for alias, config in COHERE_MODEL_CONFIGS.items()}

    @property
    def provider_name(self) -> str:
        return "cohere"
