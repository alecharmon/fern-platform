import json
from collections.abc import AsyncGenerator

import pytest
from fai_ai_core.llm.models import (
    StreamEvent,
    StreamEventType,
)

from src.models.stream import Source
from src.streaming.protocols.vercel_ui import VercelUIMessageStreamProtocol


class TestVercelUIMessageStreamProtocol:
    def _decode_types(self, chunks: list[str]) -> list[str]:
        types: list[str] = []
        for chunk in chunks:
            if chunk.strip() == "data: [DONE]":
                types.append("DONE")
                continue
            if chunk.startswith("data: "):
                payload_str = chunk[len("data: ") :].strip()
                payload = json.loads(payload_str)
                types.append(payload.get("type", "unknown"))
        return types

    @pytest.mark.asyncio
    async def test_complete_stream_sequence(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=" world")
            yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 10, "output_tokens": 5})
            yield StreamEvent(type=StreamEventType.DONE, data="")

        sources = [Source(title="Test Doc", url="https://test.com")]
        query_id = "query-123"
        message_id = "msg-456"

        chunks = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id=query_id,
            message_id=message_id,
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk)

        assert (
            chunks[0]
            == 'data: {"type": "data-sources", "data": [{"title": "Test Doc", "url": "https://test.com"}]}\n\n'
        )
        assert chunks[1] == 'data: {"type": "data-assistant-query-id", "data": "query-123"}\n\n'
        assert chunks[2] == 'data: {"type": "start", "messageId": "msg-456"}\n\n'
        assert chunks[3] == 'data: {"type":"start-step"}\n\n'
        assert chunks[4] == 'data: {"type": "text-start", "id": "0"}\n\n'
        assert chunks[5] == 'data: {"type": "text-delta", "id": "0", "delta": "Hello"}\n\n'
        assert chunks[6] == 'data: {"type": "text-delta", "id": "0", "delta": " world"}\n\n'
        assert chunks[7] == 'data: {"type": "text-end", "id": "0"}\n\n'
        assert chunks[8] == 'data: {"type":"finish-step"}\n\n'
        assert chunks[9] == 'data: {"type":"finish"}\n\n'
        assert chunks[10] == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_empty_sources(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Test")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        chunks = []
        async for chunk in protocol.stream_chat(
            sources=[],
            query_id="query-123",
            message_id="msg-456",
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk)

        assert chunks[0] == 'data: {"type": "data-sources", "data": []}\n\n'

    @pytest.mark.asyncio
    async def test_multiple_sources(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Test")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        sources = [
            Source(title="Doc 1", url="https://doc1.com"),
            Source(title="Doc 2", url="https://doc2.com"),
            Source(title="Doc 3", url="https://doc3.com"),
        ]

        chunks = []
        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="query-123",
            message_id="msg-456",
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk)

        assert 'data: {"type": "data-sources", "data": [' in chunks[0]
        assert '"title": "Doc 1"' in chunks[0]
        assert '"title": "Doc 2"' in chunks[0]
        assert '"title": "Doc 3"' in chunks[0]

    @pytest.mark.asyncio
    async def test_error_event_handling(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
            yield StreamEvent(type=StreamEventType.ERROR, data="Test error")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        chunks = []
        async for chunk in protocol.stream_chat(
            sources=[],
            query_id="query-123",
            message_id="msg-456",
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk)

        error_chunk = [c for c in chunks if "error" in c][0]
        assert '"type": "error"' in error_chunk
        assert '"message": "Test error"' in error_chunk

    @pytest.mark.asyncio
    async def test_media_type(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        assert protocol.get_media_type() == "text/event-stream"

    @pytest.mark.asyncio
    async def test_headers(self) -> None:
        protocol = VercelUIMessageStreamProtocol()
        headers = protocol.get_headers()

        assert headers["Cache-Control"] == "no-cache"
        assert headers["Connection"] == "keep-alive"
        assert headers["X-Accel-Buffering"] == "no"
        assert headers["x-vercel-ai-ui-message-stream"] == "v1"

    @pytest.mark.asyncio
    async def test_no_text_deltas(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 10})
            yield StreamEvent(type=StreamEventType.DONE, data="")

        chunks = []
        async for chunk in protocol.stream_chat(
            sources=[],
            query_id="query-123",
            message_id="msg-456",
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk)

        text_start_idx = next(i for i, c in enumerate(chunks) if "text-start" in c)
        text_end_idx = next(i for i, c in enumerate(chunks) if "text-end" in c)

        assert text_end_idx == text_start_idx + 1

    @pytest.mark.asyncio
    async def test_tool_events_not_streamed(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_START,
                data={"id": "call-1", "name": "docSearch"},
            )
            yield StreamEvent(
                type=StreamEventType.TOOL_CALL_RESULT,
                data={
                    "id": "call-1",
                    "name": "docSearch",
                    "input": {"query": "hello"},
                    "output": [{"title": "Doc", "url": "https://example.com"}],
                },
            )
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Answer")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        chunks = []
        async for chunk in protocol.stream_chat(
            sources=[Source(title="S", url="u")],
            query_id="q",
            message_id="m",
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk.strip())

        types = self._decode_types(chunks)
        assert types == [
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
            "DONE",
        ]

    @pytest.mark.asyncio
    async def test_tool_start_without_result_finishes_cleanly(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
            yield StreamEvent(type=StreamEventType.TOOL_CALL_START, data={"id": "call-1", "name": "docSearch"})
            yield StreamEvent(type=StreamEventType.DONE, data="")

        chunks = []
        async for chunk in protocol.stream_chat(
            sources=[Source(title="S", url="u")],
            query_id="q",
            message_id="m",
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk.strip())

        types = self._decode_types(chunks)
        assert types == [
            "data-sources",
            "data-assistant-query-id",
            "start",
            "start-step",
            "text-start",
            "text-delta",
            "text-end",
            "finish-step",
            "finish",
            "DONE",
        ]
