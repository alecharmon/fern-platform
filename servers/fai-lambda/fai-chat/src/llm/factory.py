"""Factory for creating LLM providers."""

from functools import lru_cache
from typing import Literal

from .anthropic_factory import AnthropicProviderFactory
from .base import LLMProvider
from .bedrock_factory import (
    BEDROCK_MODEL_CONFIGS,
    BedrockProviderFactory,
)
from .fallback import FallbackProvider
from .models import ModelId
from .provider_factory import ProviderFactory

DEFAULT_MODEL: ModelId = "claude-3.7"
FALLBACK_ORDER: list[ModelId] = ["claude-4", "claude-4.5-haiku", "claude-4.5"]


def _create_llm_provider(
    model: str | None = None,
    temperature: float = 0.0,
    max_tokens: int = 4096,
    provider_preference: list[Literal["bedrock", "anthropic"]] | None = None,
) -> LLMProvider:
    model_id = _resolve_model_id(model)
    provider_preference = provider_preference or ["bedrock", "anthropic"]

    ordered_models = _build_ordered_models(model_id)

    providers: list[LLMProvider] = []

    for provider_type in provider_preference:
        factory: ProviderFactory
        if provider_type == "bedrock":
            factory = BedrockProviderFactory()
        elif provider_type == "anthropic":
            factory = AnthropicProviderFactory()
        else:
            continue

        if not factory.is_available():
            continue

        for alias in ordered_models:
            provider = factory.create(model=alias, temperature=temperature, max_tokens=max_tokens)
            if provider:
                providers.append(provider)

    if not providers:
        raise ValueError("No providers configured. Check API keys and configuration.")

    if len(providers) == 1:
        return providers[0]

    return FallbackProvider(providers)


def _resolve_model_id(model: str | None) -> ModelId:
    m = model or DEFAULT_MODEL
    if m in BEDROCK_MODEL_CONFIGS:
        return m  # type: ignore
    return DEFAULT_MODEL


def _build_ordered_models(primary: ModelId) -> list[ModelId]:
    return [primary] + [m for m in FALLBACK_ORDER if m != primary]


@lru_cache(maxsize=8)
def get_llm_provider(
    model: str = "claude-3.7",
    temperature: float = 0.0,
    max_tokens: int = 4096,
    provider_preference_tuple: tuple[Literal["bedrock", "anthropic"], ...] = ("bedrock", "anthropic"),
) -> LLMProvider:
    provider_list: list[Literal["bedrock", "anthropic"]] = [*provider_preference_tuple]
    return _create_llm_provider(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        provider_preference=provider_list,
    )
