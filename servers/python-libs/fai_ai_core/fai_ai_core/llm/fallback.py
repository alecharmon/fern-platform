"""Fallback provider with retry logic."""

import logging
from collections.abc import AsyncGenerator, Callable

from ..tools.models import Tool
from .base import LLMProvider
from .models import (
    LLMMessage,
    LLMResponse,
    StreamEvent,
)

logger = logging.getLogger(__name__)


class FallbackProvider(LLMProvider):
    def __init__(
        self,
        providers: list[LLMProvider],
        on_fallback: Callable[[str, str, str | None], None] | None = None,
    ):
        if not providers:
            raise ValueError("FallbackProvider requires at least one provider")
        self._providers = providers
        self._current_index = 0
        self._on_fallback = on_fallback

    @property
    def model_id(self) -> str:
        return self._providers[self._current_index].model_id

    @property
    def provider_name(self) -> str:
        return self._providers[self._current_index].provider_name

    async def generate(self, messages: list[LLMMessage], tools: list[Tool] | None = None) -> LLMResponse:
        last_error = None

        for i, provider in enumerate(self._providers):
            try:
                logger.info(f"Attempting generation with provider {i}: {provider.provider_name} ({provider.model_id})")
                self._current_index = i
                response = await provider.generate(messages, tools=tools)
                logger.info(f"Successfully generated with provider {i}: {provider.provider_name}")

                if i > 0 and self._on_fallback:
                    self._on_fallback(
                        self._providers[0].provider_name,
                        provider.provider_name,
                        str(last_error) if last_error else None,
                    )

                return response
            except Exception as e:
                last_error = e
                logger.warning(f"Provider {i} ({provider.provider_name}) failed: {e}. Trying next provider...")
                continue

        raise RuntimeError(f"All {len(self._providers)} providers failed. Last error: {last_error}") from last_error

    async def generate_stream(
        self,
        messages: list[LLMMessage],
        tools: list[Tool] | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        logger.info(f"[hanging-thread] FallbackProvider.generate_stream called with {len(self._providers)} providers")
        last_error = None

        for i, provider in enumerate(self._providers):
            try:
                pname = provider.provider_name
                logger.info(f"[hanging-thread] Attempting stream with provider {i}: {pname} ({provider.model_id})")
                self._current_index = i

                stream = provider.generate_stream(messages, tools=tools)
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

            logger.info(f"[hanging-thread] First event received from provider {i}: {provider.provider_name}")
            yield first_event

            try:
                event_count = 1
                async for event in stream:
                    event_count += 1
                    yield event
                logger.info(
                    f"[hanging-thread] Stream from provider {i} ({provider.provider_name}) "
                    f"completed with {event_count} total events"
                )
            except Exception as e:
                logger.error(
                    f"[llm-fallback] Provider {i} ({provider.provider_name}) failed mid-stream after yielding events. "
                    f"Cannot fallback as partial content was already sent to client."
                )
                raise RuntimeError(
                    f"Stream failed mid-response from {provider.provider_name} ({provider.model_id}). "
                    f"Partial content was already sent to client."
                ) from e

            logger.info(f"[hanging-thread] Successfully streamed with provider {i}: {provider.provider_name}")

            if i > 0 and self._on_fallback:
                self._on_fallback(
                    self._providers[0].provider_name,
                    provider.provider_name,
                    str(last_error) if last_error else None,
                )

            return

        raise RuntimeError(f"All {len(self._providers)} providers failed. Last error: {last_error}") from last_error
