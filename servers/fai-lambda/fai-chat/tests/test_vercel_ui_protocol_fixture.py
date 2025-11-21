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
            "text-end",
            "tool-input-start",
            "tool-input-available",
            "tool-output-available",
            "finish-step",
            "start-step",
            "text-start",
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
            assert found, f"Expected event '{expected_event}' not found in correct order. " f"Got events: {event_types}"

    @pytest.mark.asyncio
    async def test_tool_call_triggers_new_step(self) -> None:
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

        text_end_idx = event_types.index("text-end")
        tool_input_start_idx = event_types.index("tool-input-start")
        assert tool_input_start_idx > text_end_idx, "tool-input-start should come after text-end"

        tool_output_idx = event_types.index("tool-output-available")
        finish_step_indices = [i for i, t in enumerate(event_types) if t == "finish-step"]
        assert len(finish_step_indices) >= 2, "Should have at least 2 finish-step events"

        first_finish_step = finish_step_indices[0]
        assert first_finish_step > tool_output_idx, "First finish-step should come after tool-output-available"

        second_start_step_indices = [i for i, t in enumerate(event_types) if t == "start-step"]
        assert len(second_start_step_indices) >= 2, "Should have at least 2 start-step events"
        second_start_step = second_start_step_indices[1]
        assert second_start_step > first_finish_step, "Second start-step should come after first finish-step"
