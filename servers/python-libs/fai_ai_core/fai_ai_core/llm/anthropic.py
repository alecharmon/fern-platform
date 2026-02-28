"""Anthropic provider implementation."""

import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic

from ..tools.models import Tool
from .base import LLMProvider
from .models import (
    LLMMessage,
    LLMMetrics,
    LLMResponse,
    StreamEvent,
    StreamEventType,
)

logger = logging.getLogger(__name__)


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

    async def generate(self, messages: list[LLMMessage], tools: list[Tool] | None = None) -> LLMResponse:
        start_time = time.time()
        system_prompt, anthropic_messages = self._extract_system_and_messages(messages)

        tool_definitions = [tool.definition.to_anthropic_format() for tool in tools] if tools else None
        tool_map = {tool.definition.name: tool for tool in tools} if tools else {}

        total_input_tokens = 0
        total_output_tokens = 0
        finish_reason = None
        content = ""

        while True:
            if system_prompt and tool_definitions:
                response = await self._client.messages.create(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                    system=system_prompt,
                    tools=tool_definitions,
                )
            elif system_prompt:
                response = await self._client.messages.create(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                    system=system_prompt,
                )
            elif tool_definitions:
                response = await self._client.messages.create(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                    tools=tool_definitions,
                )
            else:
                response = await self._client.messages.create(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                )

            if response.usage:
                total_input_tokens += response.usage.input_tokens
                total_output_tokens += response.usage.output_tokens

            finish_reason = response.stop_reason or finish_reason

            text_blocks = [block.text for block in response.content if block.type == "text"]
            tool_use_blocks = [block for block in response.content if block.type == "tool_use"]

            if not tool_use_blocks or not tools:
                content = "".join(text_blocks)
                break

            anthropic_messages.append(
                {
                    "role": "assistant",
                    "content": response.content,
                }
            )

            tool_results = []
            for tool_use in tool_use_blocks:
                start_event, result_event, tool_result = await self._handle_tool_use(tool_use, tool_map)
                _ = start_event, result_event
                tool_results.append(tool_result)

            anthropic_messages.append({"role": "user", "content": tool_results})

        total_time_ms = (time.time() - start_time) * 1000

        metrics = LLMMetrics(
            total_time_ms=total_time_ms,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
        )

        return LLMResponse(
            content=content,
            model_id=self._model_id,
            provider=self.provider_name,
            metrics=metrics,
            finish_reason=finish_reason,
        )

    async def _handle_tool_use(
        self,
        tool_use: Any,
        tool_map: dict[str, Tool],
    ) -> tuple[StreamEvent, StreamEvent, dict[str, Any]]:
        tool_name = tool_use.name
        tool_input = tool_use.input

        start_event = StreamEvent(
            type=StreamEventType.TOOL_CALL_START,
            data={
                "id": tool_use.id,
                "name": tool_name,
            },
        )

        if tool_name not in tool_map:
            error_msg = f"Unknown tool: {tool_name}"
            result_event = StreamEvent(
                type=StreamEventType.ERROR,
                data={"tool_name": tool_name, "error": error_msg},
            )
            tool_result = {
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": error_msg,
                "is_error": True,
            }
            return start_event, result_event, tool_result

        try:
            tool_output = await tool_map[tool_name].execute_with_limit(tool_input)
            result_event = StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": tool_use.id,
                    "name": tool_name,
                    "input": tool_input,
                    "output": tool_output,
                },
            )
            tool_result = {
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": json.dumps(tool_output) if isinstance(tool_output, list | dict) else str(tool_output),
            }
            return start_event, result_event, tool_result
        except Exception as e:
            error_msg = f"Tool execution error: {str(e)}"
            result_event = StreamEvent(
                type=StreamEventType.ERROR,
                data={"tool_name": tool_name, "error": error_msg},
            )
            tool_result = {
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": error_msg,
                "is_error": True,
            }
            return start_event, result_event, tool_result

    async def generate_stream(
        self,
        messages: list[LLMMessage],
        tools: list[Tool] | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        logger.info(f"[hanging-thread] AnthropicProvider.generate_stream called model={self._model_id}")
        start_time = time.time()
        time_to_first_token = None
        total_input_tokens = 0
        total_output_tokens = 0

        system_prompt, anthropic_messages = self._extract_system_and_messages(messages)

        tool_definitions = None
        tool_map = {}
        if tools:
            tool_definitions = [tool.definition.to_anthropic_format() for tool in tools]
            tool_map = {tool.definition.name: tool for tool in tools}

        while True:
            if system_prompt and tool_definitions:
                stream_context = self._client.messages.stream(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                    system=system_prompt,
                    tools=tool_definitions,
                )
            elif system_prompt:
                stream_context = self._client.messages.stream(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                    system=system_prompt,
                )
            elif tool_definitions:
                stream_context = self._client.messages.stream(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                    tools=tool_definitions,
                )
            else:
                stream_context = self._client.messages.stream(
                    model=self._model_id,
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                    messages=anthropic_messages,
                )

            logger.info(
                f"[hanging-thread] Anthropic stream context created, entering async with model={self._model_id}"
            )
            async with stream_context as stream:
                logger.info(f"[hanging-thread] Anthropic stream opened, iterating text_stream model={self._model_id}")
                async for text in stream.text_stream:
                    if time_to_first_token is None:
                        time_to_first_token = (time.time() - start_time) * 1000
                        logger.info(
                            f"[hanging-thread] Anthropic first token received, "
                            f"TTFT={time_to_first_token:.2f}ms model={self._model_id}"
                        )
                    yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=text)

                logger.info(f"[hanging-thread] Anthropic text_stream exhausted model={self._model_id}")
                logger.info(f"[hanging-thread] Anthropic awaiting get_final_message model={self._model_id}")
                final_message = await stream.get_final_message()
                logger.info(f"[hanging-thread] Anthropic get_final_message completed model={self._model_id}")

                if final_message.usage:
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                tool_use_blocks = [block for block in final_message.content if block.type == "tool_use"]

                if not tool_use_blocks:
                    logger.info(f"[hanging-thread] Anthropic no tool_use_blocks, breaking model={self._model_id}")
                    break

                anthropic_messages.append(
                    {
                        "role": "assistant",
                        "content": final_message.content,
                    }
                )

                tool_results = []
                for tool_use in tool_use_blocks:
                    start_event, result_event, tool_result = await self._handle_tool_use(tool_use, tool_map)

                    yield start_event
                    yield result_event

                    tool_results.append(tool_result)

                anthropic_messages.append({"role": "user", "content": tool_results})

        total_time_ms = (time.time() - start_time) * 1000
        logger.info(
            f"[hanging-thread] Anthropic stream loop exited, yielding USAGE and DONE "
            f"total_time_ms={total_time_ms:.2f} model={self._model_id}"
        )
        yield StreamEvent(
            type=StreamEventType.USAGE,
            data={
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "total_time_ms": total_time_ms,
                "time_to_first_token_ms": time_to_first_token,
            },
        )
        yield StreamEvent(type=StreamEventType.DONE, data="")
        logger.info(f"[hanging-thread] AnthropicProvider.generate_stream finished model={self._model_id}")
