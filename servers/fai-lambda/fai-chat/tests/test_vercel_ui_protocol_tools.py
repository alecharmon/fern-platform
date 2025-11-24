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
    async def test_tool_call_events_are_not_streamed(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = [Source(title="Test", url="https://test.com")]

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Before tool")
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
                    "output": [{"title": "Doc 1", "url": "https://example.com"}],
                },
            )
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="After tool")
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
        assert len(tool_start_chunks) == 0

        tool_input_chunks = [c for c in result if "tool-input-available" in c]
        assert len(tool_input_chunks) == 0

        tool_output_chunks = [c for c in result if "tool-output-available" in c]
        assert len(tool_output_chunks) == 0

    @pytest.mark.asyncio
    async def test_text_stream_continues_through_tool_calls(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        sources: list[Source] = []

        async def mock_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Before")
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
                    "output": [],
                },
            )
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="After")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        result = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query_2",
            message_id="msg_2",
            text_stream=mock_stream(),
        ):
            result.append(chunk)

        text_delta_chunks = [c for c in result if "text-delta" in c]
        assert len(text_delta_chunks) == 2

        before_chunk = [c for c in text_delta_chunks if "Before" in c]
        after_chunk = [c for c in text_delta_chunks if "After" in c]
        assert len(before_chunk) == 1
        assert len(after_chunk) == 1

    @pytest.mark.asyncio
    async def test_single_step_with_tool_calls(self) -> None:
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

        assert len(finish_step_chunks) == 1
        assert len(start_step_chunks) == 1

    @pytest.mark.asyncio
    async def test_multiple_tool_calls_not_streamed(self) -> None:
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
        assert len(tool_start_chunks) == 0

        tool_output_chunks = [c for c in result if "tool-output-available" in c]
        assert len(tool_output_chunks) == 0

        text_chunks = [c for c in result if "text-delta" in c and "Between calls" in c]
        assert len(text_chunks) == 1
