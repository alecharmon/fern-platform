"""Cohere provider implementation."""

import time
from collections.abc import AsyncGenerator
from typing import Any

import cohere
from cohere.types.streamed_chat_response import (
    StreamEndStreamedChatResponse,
    TextGenerationStreamedChatResponse,
)

from .base import LLMProvider
from .models import (
    LLMMessage,
    LLMMetrics,
    LLMResponse,
    StreamEvent,
    StreamEventType,
)


class CohereProvider(LLMProvider):
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
        self._client = cohere.AsyncClient(api_key=api_key)

    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def provider_name(self) -> str:
        return "cohere"

    def _format_messages(self, messages: list[LLMMessage]) -> tuple[str | None, str, list[dict[str, Any]] | None]:
        system_messages = [msg for msg in messages if msg.role.value == "system"]
        chat_messages = [msg for msg in messages if msg.role.value != "system"]

        preamble = None
        if system_messages:
            preamble = "\n\n".join(
                msg.content if isinstance(msg.content, str) else str(msg.content) for msg in system_messages
            )

        if not chat_messages:
            raise ValueError("At least one user or assistant message is required")

        last_message = chat_messages[-1]
        message_text = last_message.content if isinstance(last_message.content, str) else str(last_message.content)

        chat_history = None
        if len(chat_messages) > 1:
            chat_history = []
            for msg in chat_messages[:-1]:
                content = msg.content if isinstance(msg.content, str) else str(msg.content)
                if msg.role.value == "assistant":
                    role = "CHATBOT"
                elif msg.role.value == "user":
                    role = "USER"
                else:
                    raise ValueError(f"Unexpected role in chat history: {msg.role.value}")
                chat_history.append({"role": role, "message": content})

        return preamble, message_text, chat_history

    async def generate(self, messages: list[LLMMessage]) -> LLMResponse:
        start_time = time.time()
        preamble, message_text, chat_history = self._format_messages(messages)

        response = await self._client.chat(
            model=self._model_id,
            message=message_text,
            preamble=preamble,
            chat_history=chat_history,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
        )

        total_time_ms = (time.time() - start_time) * 1000

        content = response.text

        input_tokens = 0
        output_tokens = 0
        if response.meta and response.meta.tokens:
            input_tokens = getattr(response.meta.tokens, "input_tokens", 0)
            output_tokens = getattr(response.meta.tokens, "output_tokens", 0)

        metrics = LLMMetrics(
            total_time_ms=total_time_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        return LLMResponse(
            content=content,
            model_id=self._model_id,
            provider=self.provider_name,
            metrics=metrics,
            finish_reason=response.finish_reason,
        )

    async def generate_stream(self, messages: list[LLMMessage]) -> AsyncGenerator[StreamEvent, None]:
        start_time = time.time()
        time_to_first_token = None

        preamble, message_text, chat_history = self._format_messages(messages)

        stream = self._client.chat_stream(
            model=self._model_id,
            message=message_text,
            preamble=preamble,
            chat_history=chat_history,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
        )

        input_tokens = 0
        output_tokens = 0

        async for event in stream:
            if isinstance(event, TextGenerationStreamedChatResponse):
                if time_to_first_token is None:
                    time_to_first_token = (time.time() - start_time) * 1000
                if event.text:
                    yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=event.text)
            elif isinstance(event, StreamEndStreamedChatResponse):
                if event.response and event.response.meta and event.response.meta.tokens:
                    input_tokens = getattr(event.response.meta.tokens, "input_tokens", 0)
                    output_tokens = getattr(event.response.meta.tokens, "output_tokens", 0)

        total_time_ms = (time.time() - start_time) * 1000

        yield StreamEvent(
            type=StreamEventType.USAGE,
            data={
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_time_ms": total_time_ms,
                "time_to_first_token_ms": time_to_first_token,
            },
        )

        yield StreamEvent(type=StreamEventType.DONE, data="")
