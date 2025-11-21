"""Cohere provider implementation."""

import json
import time
from collections.abc import AsyncGenerator
from typing import Any

import cohere
from cohere.types import (
    AssistantChatMessageV2,
    SystemChatMessageV2,
    ToolCallV2,
    ToolChatMessageV2,
    UserChatMessageV2,
)
from cohere.v2.types import (
    ContentDeltaV2ChatStreamResponse,
    MessageEndV2ChatStreamResponse,
    ToolCallDeltaV2ChatStreamResponse,
    ToolCallStartV2ChatStreamResponse,
)

from ..tools.models import Tool
from .base import LLMProvider
from .models import (
    LLMMessage,
    LLMMetrics,
    LLMResponse,
    MessageRole,
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
        self._client = cohere.AsyncClientV2(api_key=api_key)

    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def provider_name(self) -> str:
        return "cohere"

    def _format_messages(self, messages: list[LLMMessage]) -> list[Any]:
        cohere_messages: list[Any] = []
        for msg in messages:
            if msg.role == MessageRole.USER:
                cohere_messages.append(UserChatMessageV2(content=msg.content))
            elif msg.role == MessageRole.ASSISTANT:
                cohere_messages.append(AssistantChatMessageV2(content=msg.content))
            elif msg.role == MessageRole.SYSTEM:
                cohere_messages.append(SystemChatMessageV2(content=msg.content))
            else:
                raise ValueError(f"Unsupported role: {msg.role}")
        return cohere_messages

    async def generate(self, messages: list[LLMMessage], tools: list[Tool] | None = None) -> LLMResponse:
        start_time = time.time()
        cohere_messages = self._format_messages(messages)
        tool_definitions = [tool.definition.to_cohere_v2_format() for tool in tools] if tools else None
        tool_map = {tool.definition.name: tool for tool in tools} if tools else {}

        total_input_tokens = 0
        total_output_tokens = 0
        finish_reason = None
        content = ""

        while True:
            response = await self._client.chat(
                model=self._model_id,
                messages=cohere_messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                tools=tool_definitions,
            )

            if response.usage and response.usage.tokens:
                total_input_tokens += int(response.usage.tokens.input_tokens or 0)
                total_output_tokens += int(response.usage.tokens.output_tokens or 0)

            finish_reason = str(response.finish_reason) if response.finish_reason is not None else finish_reason

            tool_calls = response.message.tool_calls if response.message and response.message.tool_calls else None
            assistant_content = response.message.content if response.message else None

            if not tool_calls or not tools:
                if assistant_content:
                    content_parts: list[str] = []
                    for part in assistant_content:
                        if getattr(part, "type", None) == "text" and getattr(part, "text", None):
                            content_parts.append(part.text)
                    content = "".join(content_parts)
                break

            assistant_message = AssistantChatMessageV2(content=assistant_content, tool_calls=tool_calls)
            cohere_messages.append(assistant_message)

            tool_results: list[ToolChatMessageV2] = []
            for tool_call in tool_calls:
                start_event, result_event, tool_result = await self._handle_tool_call(tool_call, tool_map)
                # Non-stream path ignores start/result events, but tool_result is reused in messages.
                _ = start_event, result_event
                tool_results.append(tool_result)

            cohere_messages.extend(tool_results)

        metrics = LLMMetrics(
            total_time_ms=(time.time() - start_time) * 1000,
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

    async def _handle_tool_call(
        self,
        tool_call: ToolCallV2,
        tool_map: dict[str, Tool],
    ) -> tuple[StreamEvent, StreamEvent, ToolChatMessageV2]:
        if not tool_call.id:
            raise ValueError("Cohere tool call missing id")

        tool_call_id = tool_call.id
        tool_name = tool_call.function.name if tool_call.function else ""
        arguments = tool_call.function.arguments if tool_call.function and tool_call.function.arguments else "{}"

        start_event = StreamEvent(
            type=StreamEventType.TOOL_CALL_START,
            data={"id": tool_call_id, "name": tool_name},
        )

        try:
            tool_input = json.loads(arguments) if arguments else {}
        except json.JSONDecodeError:
            tool_input = {}

        if tool_name not in tool_map:
            error_msg = f"Unknown tool: {tool_name}"
            result_event = StreamEvent(
                type=StreamEventType.ERROR,
                data={"tool_name": tool_name, "error": error_msg},
            )
            tool_content = [{"type": "document", "document": {"data": {"error": error_msg}}}]
            tool_result_message = ToolChatMessageV2(tool_call_id=tool_call_id, content=tool_content)
            return start_event, result_event, tool_result_message

        try:
            tool_output = await tool_map[tool_name].execute_with_limit(tool_input)
            result_event = StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={"id": tool_call_id, "name": tool_name, "input": tool_input, "output": tool_output},
            )

            outputs = tool_output if isinstance(tool_output, list) else [tool_output]
            tool_content = []
            for item in outputs:
                data = item if isinstance(item, dict) else {"result": str(item)}
                tool_content.append({"type": "document", "document": {"data": data}})

            tool_result_message = ToolChatMessageV2(tool_call_id=tool_call_id, content=tool_content)
            return start_event, result_event, tool_result_message
        except Exception as e:
            error_msg = f"Tool execution error: {str(e)}"
            result_event = StreamEvent(
                type=StreamEventType.ERROR,
                data={"tool_name": tool_name, "error": error_msg},
            )
            tool_content = [{"type": "document", "document": {"data": {"error": error_msg}}}]
            tool_result_message = ToolChatMessageV2(tool_call_id=tool_call_id, content=tool_content)
            return start_event, result_event, tool_result_message

    async def generate_stream(
        self,
        messages: list[LLMMessage],
        tools: list[Tool] | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        start_time = time.time()
        time_to_first_token = None
        total_input_tokens = 0
        total_output_tokens = 0

        cohere_messages = self._format_messages(messages)

        tool_definitions = [tool.definition.to_cohere_v2_format() for tool in tools] if tools else None
        tool_map = {tool.definition.name: tool for tool in tools} if tools else {}

        while True:
            stream_kwargs: dict[str, Any] = {
                "model": self._model_id,
                "messages": cohere_messages,
                "temperature": self._temperature,
                "max_tokens": self._max_tokens,
            }
            if tool_definitions:
                stream_kwargs["tools"] = tool_definitions

            stream = self._client.chat_stream(**stream_kwargs)

            tool_calls: dict[int, ToolCallV2] = {}
            content_chunks: dict[int, list[str]] = {}

            async for event in stream:
                if isinstance(event, ContentDeltaV2ChatStreamResponse):
                    text_delta = None
                    if event.delta and event.delta.message and event.delta.message.content:
                        text_delta = event.delta.message.content.text
                    if text_delta:
                        if time_to_first_token is None:
                            time_to_first_token = (time.time() - start_time) * 1000
                        content_chunks.setdefault(event.index or 0, []).append(text_delta)
                        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=text_delta)
                elif isinstance(event, ToolCallStartV2ChatStreamResponse):
                    tool_call = event.delta.message.tool_calls if event.delta and event.delta.message else None
                    if tool_call:
                        tool_call.type = tool_call.type or "function"
                        if tool_call.function:
                            tool_call.function.arguments = tool_call.function.arguments or ""
                        tool_calls[event.index or len(tool_calls)] = tool_call
                elif isinstance(event, ToolCallDeltaV2ChatStreamResponse):
                    delta_call = event.delta.message.tool_calls if event.delta and event.delta.message else None
                    if delta_call and delta_call.function and delta_call.function.arguments:
                        call_index = event.index or 0
                        if call_index in tool_calls and tool_calls[call_index].function:
                            current_arguments = tool_calls[call_index].function.arguments or ""
                            tool_calls[call_index].function.arguments = (
                                current_arguments + delta_call.function.arguments
                            )
                elif isinstance(event, MessageEndV2ChatStreamResponse):
                    if event.delta and event.delta.usage and event.delta.usage.tokens:
                        total_input_tokens += int(event.delta.usage.tokens.input_tokens or 0)
                        total_output_tokens += int(event.delta.usage.tokens.output_tokens or 0)

            tool_call_list = [tool_calls[idx] for idx in sorted(tool_calls)]
            if not tool_call_list:
                break

            assistant_content = []
            for idx in sorted(content_chunks):
                text_block = "".join(content_chunks[idx])
                if text_block:
                    assistant_content.append({"type": "text", "text": text_block})

            assistant_message = AssistantChatMessageV2(
                content=assistant_content or None,
                tool_calls=tool_call_list,
            )
            cohere_messages.append(assistant_message)

            tool_results: list[ToolChatMessageV2] = []
            for tool_call in tool_call_list:
                start_event, result_event, tool_result = await self._handle_tool_call(tool_call, tool_map)
                yield start_event
                yield result_event
                tool_results.append(tool_result)

            cohere_messages.extend(tool_results)

        total_time_ms = (time.time() - start_time) * 1000
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
