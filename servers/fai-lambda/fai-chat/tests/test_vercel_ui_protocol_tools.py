import json
from collections.abc import AsyncGenerator

import pytest

from src.llm.models import (
    StreamEvent,
    StreamEventType,
)
from src.models.stream import Source
from src.streaming.protocols.vercel_ui import VercelUIMessageStreamProtocol


class TestVercelUIProtocolToolEvents:
    @pytest.mark.asyncio
    async def test_tool_call_start_event(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = [Source(title="Test", url="https://test.com")]

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "tool_123", "name": "documentationSearch"},
            )
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query_1",
            message_id="msg_1",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        tool_start_chunks = [c for c in result if "tool-input-start" in c]
        assert len(tool_start_chunks) == 1

        tool_start_data = json.loads(tool_start_chunks[0].replace("data: ", "").strip())
        assert tool_start_data["type"] == "tool-input-start"
        assert tool_start_data["toolCallId"] == "tool_123"
        assert tool_start_data["toolName"] == "documentationSearch"

        text_end_before_tool = [i for i, c in enumerate(result) if "text-end" in c and i < len(result) - 3]
        assert len(text_end_before_tool) > 0

    @pytest.mark.asyncio
    async def test_tool_call_result_event(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = []

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "tool_456", "name": "documentationSearch"},
            )
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": "tool_456",
                    "name": "documentationSearch",
                    "input": {"query": "test query"},
                    "output": [{"title": "Doc 1", "url": "https://example.com"}],
                },
            )
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query_2",
            message_id="msg_2",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        input_available_chunks = [c for c in result if "tool-input-available" in c]
        assert len(input_available_chunks) == 1

        input_data = json.loads(input_available_chunks[0].replace("data: ", "").strip())
        assert input_data["type"] == "tool-input-available"
        assert input_data["toolCallId"] == "tool_456"
        assert input_data["toolName"] == "documentationSearch"
        assert input_data["input"] == {"query": "test query"}

        output_available_chunks = [c for c in result if "tool-output-available" in c]
        assert len(output_available_chunks) == 1

        output_data = json.loads(output_available_chunks[0].replace("data: ", "").strip())
        assert output_data["type"] == "tool-output-available"
        assert output_data["toolCallId"] == "tool_456"
        assert len(output_data["output"]) == 1
        assert output_data["output"][0]["title"] == "Doc 1"

    @pytest.mark.asyncio
    async def test_tool_call_starts_new_step(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = []

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Before tool")
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "tool_789", "name": "documentationSearch"},
            )
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": "tool_789",
                    "name": "documentationSearch",
                    "input": {"query": "test"},
                    "output": [],
                },
            )
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="After tool")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query_3",
            message_id="msg_3",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        finish_step_chunks = [c for c in result if "finish-step" in c]
        start_step_chunks = [c for c in result if "start-step" in c]

        assert len(finish_step_chunks) >= 2
        assert len(start_step_chunks) >= 2

    @pytest.mark.asyncio
    async def test_multiple_tool_calls(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = []

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "tool_1", "name": "documentationSearch"},
            )
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": "tool_1",
                    "name": "documentationSearch",
                    "input": {"query": "query1"},
                    "output": [],
                },
            )
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Between calls")
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "tool_2", "name": "documentationSearch"},
            )
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": "tool_2",
                    "name": "documentationSearch",
                    "input": {"query": "query2"},
                    "output": [],
                },
            )
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query_4",
            message_id="msg_4",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        tool_start_chunks = [c for c in result if "tool-input-start" in c]
        assert len(tool_start_chunks) == 2

        tool_output_chunks = [c for c in result if "tool-output-available" in c]
        assert len(tool_output_chunks) == 2

    @pytest.mark.asyncio
    async def test_tool_event_with_non_dict_data_ignored(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = []

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TOOL_CALL_START, data="invalid")
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Normal text")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query_5",
            message_id="msg_5",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        tool_chunks = [c for c in result if "tool-input-start" in c]
        assert len(tool_chunks) == 0

        text_chunks = [c for c in result if "text-delta" in c and "Normal text" in c]
        assert len(text_chunks) == 1
