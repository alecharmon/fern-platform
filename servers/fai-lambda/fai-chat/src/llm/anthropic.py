"""Anthropic provider implementation."""

import time
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic

from .base import LLMProvider
from .models import (
    LLMMessage,
    LLMMetrics,
    LLMResponse,
    StreamEvent,
    StreamEventType,
)


class AnthropicProvider(LLMProvider):
    def __init__(
        self,
        model_id: str,
        api_key: str,
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ):
        self._model_id = model_id
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._client = AsyncAnthropic(api_key=api_key)

    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def provider_name(self) -> str:
        return "anthropic"

    def _extract_system_and_messages(self, messages: list[LLMMessage]) -> tuple[str | None, list[dict[str, Any]]]:
        system_messages = [msg for msg in messages if msg.role.value == "system"]
        user_assistant_messages = [msg for msg in messages if msg.role.value != "system"]

        system_prompt = None
        if system_messages:
            system_prompt = "\n\n".join(
                msg.content if isinstance(msg.content, str) else str(msg.content) for msg in system_messages
            )

        return system_prompt, [msg.to_dict() for msg in user_assistant_messages]

    async def generate(self, messages: list[LLMMessage]) -> LLMResponse:
        start_time = time.time()
        system_prompt, anthropic_messages = self._extract_system_and_messages(messages)

        if system_prompt:
            response = await self._client.messages.create(
                model=self._model_id,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
                messages=anthropic_messages,
                system=system_prompt,
            )
        else:
            response = await self._client.messages.create(
                model=self._model_id,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
                messages=anthropic_messages,
            )

        total_time_ms = (time.time() - start_time) * 1000

        content = ""
        for block in response.content:
            if block.type == "text":
                content += block.text

        metrics = LLMMetrics(
            total_time_ms=total_time_ms,
            input_tokens=response.usage.input_tokens if response.usage else 0,
            output_tokens=response.usage.output_tokens if response.usage else 0,
        )

        return LLMResponse(
            content=content,
            model_id=self._model_id,
            provider=self.provider_name,
            metrics=metrics,
            finish_reason=response.stop_reason,
        )

    async def generate_stream(self, messages: list[LLMMessage]) -> AsyncGenerator[StreamEvent, None]:
        start_time = time.time()
        time_to_first_token = None

        system_prompt, anthropic_messages = self._extract_system_and_messages(messages)

        if system_prompt:
            stream_context = self._client.messages.stream(
                model=self._model_id,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
                messages=anthropic_messages,
                system=system_prompt,
            )
        else:
            stream_context = self._client.messages.stream(
                model=self._model_id,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
                messages=anthropic_messages,
            )

        async with stream_context as stream:
            async for text in stream.text_stream:
                if time_to_first_token is None:
                    time_to_first_token = (time.time() - start_time) * 1000
                yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=text)

            total_time_ms = (time.time() - start_time) * 1000
            final_message = await stream.get_final_message()

            if final_message.usage:
                yield StreamEvent(
                    type=StreamEventType.USAGE,
                    data={
                        "input_tokens": final_message.usage.input_tokens,
                        "output_tokens": final_message.usage.output_tokens,
                        "total_time_ms": total_time_ms,
                        "time_to_first_token_ms": time_to_first_token,
                    },
                )

        yield StreamEvent(type=StreamEventType.DONE, data="")
