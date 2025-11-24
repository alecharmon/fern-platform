import json
from collections.abc import AsyncGenerator

import pytest

from src.llm.models import (
    StreamEvent,
    StreamEventType,
)
from src.models.stream import Source
from src.streaming.protocols.vercel_ui import VercelUIMessageStreamProtocol


class TestVercelUIProtocolFixture:
    @pytest.mark.asyncio
    async def test_event_order_matches_expected_format(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources = [
            Source(title="Test Doc", url="https://test.com/doc"),
        ]

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Before tool call")
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "tool_123", "name": "documentationSearch"},
            )
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": "tool_123",
                    "name": "documentationSearch",
                    "input": {"query": "test query"},
                    "output": [{"title": "Result", "url": "https://result.com"}],
                },
            )
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="After tool call")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result: list[str] = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query_123",
            message_id="msg_123",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        event_types: list[str] = []
        for chunk in result:
            if "data: " in chunk and chunk.strip() != "data: [DONE]":
                try:
                    json_str = chunk.replace("data: ", "").strip()
                    if json_str:
                        parsed = json.loads(json_str)
                        if isinstance(parsed, dict) and "type" in parsed:
                            event_types.append(parsed["type"])
                except json.JSONDecodeError:
                    pass

        expected_order = [
            "data-sources",
            "data-assistant-query-id",
            "start",
            "start-step",
            "text-start",
            "text-delta",
            "text-delta",
            "text-end",
            "finish-step",
            "finish",
        ]

        current_idx = 0
        for expected_event in expected_order:
            found = False
            for i in range(current_idx, len(event_types)):
                if event_types[i] == expected_event:
                    current_idx = i + 1
                    found = True
                    break
            assert found, f"Expected event '{expected_event}' not found in correct order. Got events: {event_types}"

        tool_events = [e for e in event_types if "tool" in e]
        assert len(tool_events) == 0, f"Tool events should not be streamed. Got: {tool_events}"

    @pytest.mark.asyncio
    async def test_tool_calls_do_not_create_new_steps(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = []

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Text before tool")
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "tool_1", "name": "documentationSearch"},
            )
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": "tool_1",
                    "name": "documentationSearch",
                    "input": {"query": "test"},
                    "output": [],
                },
            )
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Text after tool")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result: list[str] = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="q1",
            message_id="m1",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        event_types: list[str] = []
        for chunk in result:
            if "data: " in chunk and chunk.strip() != "data: [DONE]":
                try:
                    json_str = chunk.replace("data: ", "").strip()
                    if json_str:
                        parsed = json.loads(json_str)
                        if isinstance(parsed, dict) and "type" in parsed:
                            event_types.append(parsed["type"])
                except json.JSONDecodeError:
                    pass

        finish_step_count = sum(1 for e in event_types if e == "finish-step")
        start_step_count = sum(1 for e in event_types if e == "start-step")

        assert finish_step_count == 1, f"Should have exactly 1 finish-step. Got: {finish_step_count}"
        assert start_step_count == 1, f"Should have exactly 1 start-step. Got: {start_step_count}"
