"""AWS Bedrock provider implementation."""

import time
from collections.abc import AsyncGenerator
from typing import Any

import aioboto3

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
    ):
        self._model_id = model_id
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._region = region
        self._aws_access_key_id = aws_access_key_id
        self._aws_secret_access_key = aws_secret_access_key
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

    async def generate(self, messages: list[LLMMessage]) -> LLMResponse:
        start_time = time.time()
        system_blocks, bedrock_messages = self._extract_system_and_messages(messages)

        inference_config = {
            "maxTokens": self._max_tokens,
            "temperature": self._temperature,
        }

        session = self._get_session()
        async with session.client("bedrock-runtime") as client:
            if system_blocks:
                response = await client.converse(
                    modelId=self._model_id,
                    messages=bedrock_messages,
                    inferenceConfig=inference_config,
                    system=system_blocks,
                )
            else:
                response = await client.converse(
                    modelId=self._model_id,
                    messages=bedrock_messages,
                    inferenceConfig=inference_config,
                )

            total_time_ms = (time.time() - start_time) * 1000

            content = ""
            for block in response["output"]["message"]["content"]:
                if "text" in block:
                    content += block["text"]

            metrics = LLMMetrics(
                total_time_ms=total_time_ms,
                input_tokens=response["usage"].get("inputTokens", 0) if "usage" in response else 0,
                output_tokens=response["usage"].get("outputTokens", 0) if "usage" in response else 0,
            )

            return LLMResponse(
                content=content,
                model_id=self._model_id,
                provider=self.provider_name,
                metrics=metrics,
                finish_reason=response.get("stopReason"),
            )

    async def generate_stream(self, messages: list[LLMMessage]) -> AsyncGenerator[StreamEvent, None]:
        start_time = time.time()
        time_to_first_token = None

        system_blocks, bedrock_messages = self._extract_system_and_messages(messages)

        inference_config = {
            "maxTokens": self._max_tokens,
            "temperature": self._temperature,
        }

        session = self._get_session()
        async with session.client("bedrock-runtime") as client:
            if system_blocks:
                response = await client.converse_stream(
                    modelId=self._model_id,
                    messages=bedrock_messages,
                    inferenceConfig=inference_config,
                    system=system_blocks,
                )
            else:
                response = await client.converse_stream(
                    modelId=self._model_id,
                    messages=bedrock_messages,
                    inferenceConfig=inference_config,
                )

            async for event in response["stream"]:
                if "contentBlockDelta" in event:
                    if time_to_first_token is None:
                        time_to_first_token = (time.time() - start_time) * 1000
                    delta = event["contentBlockDelta"]["delta"]
                    if "text" in delta:
                        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=delta["text"])
                elif "metadata" in event:
                    total_time_ms = (time.time() - start_time) * 1000
                    metadata = event["metadata"]
                    if "usage" in metadata:
                        yield StreamEvent(
                            type=StreamEventType.USAGE,
                            data={
                                "input_tokens": metadata["usage"].get("inputTokens", 0),
                                "output_tokens": metadata["usage"].get("outputTokens", 0),
                                "total_time_ms": total_time_ms,
                                "time_to_first_token_ms": time_to_first_token,
                            },
                        )

            yield StreamEvent(type=StreamEventType.DONE, data="")
