"""AWS Bedrock provider implementation."""

import json
import time
from collections.abc import AsyncGenerator
from typing import Any

import aioboto3

from ..tools.models import Tool
from .base import LLMProvider
from .models import (
    LLMMessage,
    LLMMetrics,
    LLMResponse,
    StreamEvent,
    StreamEventType,
)


class BedrockProvider(LLMProvider):
    def __init__(
        self,
        model_id: str,
        region: str = "us-east-1",
        temperature: float = 0.0,
        max_tokens: int = 4096,
        aws_access_key_id: str | None = None,
        aws_secret_access_key: str | None = None,
        aws_session_token: str | None = None,
    ):
        self._model_id = model_id
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._region = region
        self._aws_access_key_id = aws_access_key_id
        self._aws_secret_access_key = aws_secret_access_key
        self._aws_session_token = aws_session_token
        self._session = None

    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def provider_name(self) -> str:
        return "bedrock"

    def _get_session(self) -> aioboto3.Session:
        if self._session is None:
            if self._aws_access_key_id and self._aws_secret_access_key:
                self._session = aioboto3.Session(
                    region_name=self._region,
                    aws_access_key_id=self._aws_access_key_id,
                    aws_secret_access_key=self._aws_secret_access_key,
                    aws_session_token=self._aws_session_token,
                )
            else:
                self._session = aioboto3.Session(region_name=self._region)
        return self._session

    def _extract_system_and_messages(
        self, messages: list[LLMMessage]
    ) -> tuple[list[dict[str, str]] | None, list[dict[str, Any]]]:
        system_messages = [msg for msg in messages if msg.role.value == "system"]
        user_assistant_messages = [msg for msg in messages if msg.role.value != "system"]

        system_blocks = None
        if system_messages:
            system_blocks = []
            for msg in system_messages:
                text_content = msg.content if isinstance(msg.content, str) else str(msg.content)
                system_blocks.append({"text": text_content})

        bedrock_messages: list[dict[str, Any]] = []
        for msg in user_assistant_messages:
            msg_content: Any = msg.content
            if isinstance(msg_content, str):
                msg_content = [{"text": msg_content}]
            bedrock_messages.append({"role": msg.role.value, "content": msg_content})

        return system_blocks, bedrock_messages

    async def generate(self, messages: list[LLMMessage], tools: list[Tool] | None = None) -> LLMResponse:
        start_time = time.time()
        system_blocks, bedrock_messages = self._extract_system_and_messages(messages)

        inference_config = {
            "maxTokens": self._max_tokens,
            "temperature": self._temperature,
        }

        tool_config = {"tools": [tool.definition.to_bedrock_format() for tool in tools]} if tools else None
        tool_map = {tool.definition.name: tool for tool in tools} if tools else {}

        total_input_tokens = 0
        total_output_tokens = 0
        content = ""
        finish_reason = None

        session = self._get_session()
        async with session.client("bedrock-runtime") as client:
            while True:
                if system_blocks and tool_config:
                    response = await client.converse(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                        system=system_blocks,
                        toolConfig=tool_config,
                    )
                elif system_blocks:
                    response = await client.converse(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                        system=system_blocks,
                    )
                elif tool_config:
                    response = await client.converse(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                        toolConfig=tool_config,
                    )
                else:
                    response = await client.converse(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                    )

                if "usage" in response:
                    total_input_tokens += response["usage"].get("inputTokens", 0)
                    total_output_tokens += response["usage"].get("outputTokens", 0)

                finish_reason = response.get("stopReason", finish_reason)

                message_content = response["output"]["message"]["content"]
                tool_use_list = []
                for block in message_content:
                    if "toolUse" in block:
                        tool_use_list.append(block["toolUse"])

                if not tool_use_list or not tools:
                    content_parts = [block["text"] for block in message_content if "text" in block]
                    content = "".join(content_parts)
                    break

                bedrock_messages.append({"role": "assistant", "content": message_content})

                tool_results = []
                for tool_use in tool_use_list:
                    start_event, result_event, tool_result = await self._handle_tool_use(tool_use, tool_map)
                    _ = start_event, result_event
                    tool_results.append({"toolResult": tool_result})

                bedrock_messages.append({"role": "user", "content": tool_results})

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
        tool_use: dict[str, Any],
        tool_map: dict[str, Tool],
    ) -> tuple[StreamEvent, StreamEvent, dict[str, Any]]:
        tool_use_id = tool_use.get("toolUseId", "")
        tool_name = tool_use.get("name", "")
        tool_input = tool_use.get("input", {})

        start_event = StreamEvent(
            type=StreamEventType.TOOL_CALL_START,
            data={
                "id": tool_use_id,
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
                "toolUseId": tool_use_id,
                "content": [{"text": error_msg}],
                "status": "error",
            }
            return start_event, result_event, tool_result

        try:
            tool_output = await tool_map[tool_name].execute_with_limit(tool_input)
            result_event = StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": tool_use_id,
                    "name": tool_name,
                    "input": tool_input,
                    "output": tool_output,
                },
            )
            tool_result = {
                "toolUseId": tool_use_id,
                "content": [{"json": {"results": tool_output}}],
            }
            return start_event, result_event, tool_result
        except Exception as e:
            error_msg = f"Tool execution error: {str(e)}"
            result_event = StreamEvent(
                type=StreamEventType.ERROR,
                data={"tool_name": tool_name, "error": error_msg},
            )
            tool_result = {
                "toolUseId": tool_use_id,
                "content": [{"text": error_msg}],
                "status": "error",
            }
            return start_event, result_event, tool_result

    async def generate_stream(
        self,
        messages: list[LLMMessage],
        tools: list[Tool] | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        start_time = time.time()
        time_to_first_token = None
        total_input_tokens = 0
        total_output_tokens = 0

        system_blocks, bedrock_messages = self._extract_system_and_messages(messages)

        inference_config = {
            "maxTokens": self._max_tokens,
            "temperature": self._temperature,
        }

        tool_config = None
        tool_map = {}
        if tools:
            tool_config = {"tools": [tool.definition.to_bedrock_format() for tool in tools]}
            tool_map = {tool.definition.name: tool for tool in tools}

        session = self._get_session()
        async with session.client("bedrock-runtime") as client:
            while True:
                if system_blocks and tool_config:
                    response = await client.converse_stream(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                        system=system_blocks,
                        toolConfig=tool_config,
                    )
                elif system_blocks:
                    response = await client.converse_stream(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                        system=system_blocks,
                    )
                elif tool_config:
                    response = await client.converse_stream(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                        toolConfig=tool_config,
                    )
                else:
                    response = await client.converse_stream(
                        modelId=self._model_id,
                        messages=bedrock_messages,
                        inferenceConfig=inference_config,
                    )

                tool_uses: dict[int, dict[str, Any]] = {}

                async for event in response["stream"]:
                    if "contentBlockStart" in event:
                        block_start = event["contentBlockStart"]
                        block_index = block_start.get("contentBlockIndex", 0)
                        start_block = block_start["start"]
                        if "toolUse" in start_block:
                            tool_uses[block_index] = {
                                "toolUseId": start_block["toolUse"].get("toolUseId", ""),
                                "name": start_block["toolUse"].get("name", ""),
                                "input": "",
                            }
                    elif "contentBlockDelta" in event:
                        if time_to_first_token is None:
                            time_to_first_token = (time.time() - start_time) * 1000
                        block_delta = event["contentBlockDelta"]
                        block_index = block_delta.get("contentBlockIndex", 0)
                        delta = block_delta["delta"]
                        if "text" in delta:
                            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=delta["text"])
                        elif "toolUse" in delta:
                            if block_index in tool_uses:
                                input_delta = delta["toolUse"].get("input", "")
                                tool_uses[block_index]["input"] += input_delta
                    elif "metadata" in event:
                        metadata = event["metadata"]
                        if "usage" in metadata:
                            total_input_tokens += metadata["usage"].get("inputTokens", 0)
                            total_output_tokens += metadata["usage"].get("outputTokens", 0)

                tool_use_list = []
                for tool_use_data in tool_uses.values():
                    try:
                        parsed_input = json.loads(tool_use_data["input"]) if tool_use_data["input"] else {}
                    except json.JSONDecodeError:
                        parsed_input = {}

                    tool_use_list.append(
                        {
                            "toolUseId": tool_use_data["toolUseId"],
                            "name": tool_use_data["name"],
                            "input": parsed_input,
                        }
                    )

                if not tool_use_list:
                    break

                assistant_content = [{"toolUse": tool_use} for tool_use in tool_use_list]
                bedrock_messages.append({"role": "assistant", "content": assistant_content})

                tool_results = []
                for tool_use in tool_use_list:
                    start_event, result_event, tool_result = await self._handle_tool_use(tool_use, tool_map)

                    yield start_event
                    yield result_event

                    tool_results.append({"toolResult": tool_result})

                bedrock_messages.append({"role": "user", "content": tool_results})

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
