"""Fallback provider with retry logic."""

import logging
from collections.abc import AsyncGenerator

from .base import LLMProvider
from .models import (
    LLMMessage,
    LLMResponse,
    StreamEvent,
)

logger = logging.getLogger(__name__)


class FallbackProvider(LLMProvider):
    def __init__(self, providers: list[LLMProvider]):
        if not providers:
            raise ValueError("FallbackProvider requires at least one provider")
        self._providers = providers
        self._current_index = 0

    @property
    def model_id(self) -> str:
        return self._providers[self._current_index].model_id

    @property
    def provider_name(self) -> str:
        return self._providers[self._current_index].provider_name

    async def generate(self, messages: list[LLMMessage]) -> LLMResponse:
        last_error = None

        for i, provider in enumerate(self._providers):
            try:
                logger.info(f"Attempting generation with provider {i}: {provider.provider_name} ({provider.model_id})")
                self._current_index = i
                response = await provider.generate(messages)
                logger.info(f"Successfully generated with provider {i}: {provider.provider_name}")
                return response
            except Exception as e:
                last_error = e
                logger.warning(f"Provider {i} ({provider.provider_name}) failed: {e}. Trying next provider...")
                continue

        raise RuntimeError(f"All {len(self._providers)} providers failed. Last error: {last_error}") from last_error

    async def generate_stream(self, messages: list[LLMMessage]) -> AsyncGenerator[StreamEvent, None]:
        last_error = None

        for i, provider in enumerate(self._providers):
            try:
                logger.info(f"Attempting stream with provider {i}: {provider.provider_name} ({provider.model_id})")
                self._current_index = i

                stream = provider.generate_stream(messages)
                first_event = await anext(stream)
            except StopAsyncIteration:
                logger.info(f"Provider {i} ({provider.provider_name}) completed with no events")
                return
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Provider {i} ({provider.provider_name}) failed before streaming: {e}. Trying next provider..."
                )
                continue

            yield first_event

            try:
                async for event in stream:
                    yield event
            except Exception as e:
                logger.error(
                    f"Provider {i} ({provider.provider_name}) failed mid-stream after yielding events. "
                    f"Cannot fallback as partial content was already sent to client."
                )
                raise RuntimeError(
                    f"Stream failed mid-response from {provider.provider_name} ({provider.model_id}). "
                    f"Partial content was already sent to client."
                ) from e

            logger.info(f"Successfully streamed with provider {i}: {provider.provider_name}")
            return

        raise RuntimeError(f"All {len(self._providers)} providers failed. Last error: {last_error}") from last_error
