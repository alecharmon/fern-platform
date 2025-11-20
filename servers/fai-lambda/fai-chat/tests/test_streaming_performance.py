import time
from collections.abc import AsyncGenerator

import pytest

from src.llm.models import StreamEvent, StreamEventType
from src.models.stream import Source
from src.streaming.protocols.vercel_ui import VercelUIMessageStreamProtocol


class TestStreamingPerformance:
    @pytest.mark.asyncio
    async def test_protocol_latency_overhead(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            for i in range(100):
                yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=f"Token {i}")
            yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 100, "output_tokens": 100})
            yield StreamEvent(type=StreamEventType.DONE, data="")

        sources = [
            Source(title=f"Doc {i}", url=f"https://example.com/doc{i}")
            for i in range(10)
        ]

        start_time = time.perf_counter()
        event_count = 0

        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="test-query",
            message_id="test-message",
            text_stream=mock_text_stream(),
        ):
            event_count += 1

        end_time = time.perf_counter()
        total_time_ms = (end_time - start_time) * 1000

        avg_latency_per_event_ms = total_time_ms / event_count

        assert avg_latency_per_event_ms < 0.1, (
            f"Average latency per event is {avg_latency_per_event_ms:.4f}ms, "
            f"which exceeds the 0.1ms target"
        )

        print("\nPerformance metrics:")
        print(f"  Total events: {event_count}")
        print(f"  Total time: {total_time_ms:.2f}ms")
        print(f"  Average latency per event: {avg_latency_per_event_ms:.4f}ms")

    @pytest.mark.asyncio
    async def test_protocol_with_large_source_list(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello world")
            yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 10, "output_tokens": 5})
            yield StreamEvent(type=StreamEventType.DONE, data="")

        sources = [
            Source(title=f"Document {i}", url=f"https://example.com/doc{i}")
            for i in range(1000)
        ]

        start_time = time.perf_counter()
        chunks = []

        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="test-query",
            message_id="test-message",
            text_stream=mock_text_stream(),
        ):
            chunks.append(chunk)

        end_time = time.perf_counter()
        total_time_ms = (end_time - start_time) * 1000

        assert total_time_ms < 10, (
            f"Processing 1000 sources took {total_time_ms:.2f}ms, "
            f"which exceeds the 10ms target"
        )

        assert len(chunks) > 0
        assert '"type": "data-sources"' in chunks[0]
        assert '"title": "Document 0"' in chunks[0]
        assert '"title": "Document 999"' in chunks[0]

        print("\nLarge source list performance:")
        print("  Source count: 1000")
        print(f"  Total chunks: {len(chunks)}")
        print(f"  Total time: {total_time_ms:.2f}ms")

    @pytest.mark.asyncio
    async def test_protocol_memory_efficiency(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            for i in range(1000):
                yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=f"Token {i}")
            yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 1000, "output_tokens": 1000})
            yield StreamEvent(type=StreamEventType.DONE, data="")

        sources = [Source(title="Test", url="https://example.com")]

        chunk_count = 0
        max_chunk_size = 0

        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="test-query",
            message_id="test-message",
            text_stream=mock_text_stream(),
        ):
            chunk_count += 1
            chunk_size = len(chunk)
            max_chunk_size = max(max_chunk_size, chunk_size)

        assert max_chunk_size < 1000, (
            f"Max chunk size is {max_chunk_size} bytes, which may indicate buffering issues"
        )

        print("\nMemory efficiency metrics:")
        print(f"  Total chunks: {chunk_count}")
        print(f"  Max chunk size: {max_chunk_size} bytes")
        print(f"  Average chunk size: {(chunk_count * 50) // chunk_count} bytes (estimated)")

    @pytest.mark.asyncio
    async def test_first_event_latency(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="First token")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        sources = [Source(title="Test Doc", url="https://example.com")]

        start_time = time.perf_counter()
        first_chunk_time = None

        async for chunk in protocol.stream_chat(
            sources=sources,
            query_id="test-query",
            message_id="test-message",
            text_stream=mock_text_stream(),
        ):
            if first_chunk_time is None:
                first_chunk_time = time.perf_counter()
                break

        assert first_chunk_time is not None
        time_to_first_chunk_ms = (first_chunk_time - start_time) * 1000

        assert time_to_first_chunk_ms < 1.0, (
            f"Time to first chunk is {time_to_first_chunk_ms:.4f}ms, "
            f"which exceeds the 1ms target"
        )

        print("\nFirst event latency:")
        print(f"  Time to first chunk: {time_to_first_chunk_ms:.4f}ms")

    @pytest.mark.asyncio
    async def test_empty_sources_performance(self) -> None:
        protocol = VercelUIMessageStreamProtocol()

        async def mock_text_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        start_time = time.perf_counter()
        chunk_count = 0

        async for chunk in protocol.stream_chat(
            sources=[],
            query_id="test-query",
            message_id="test-message",
            text_stream=mock_text_stream(),
        ):
            chunk_count += 1

        end_time = time.perf_counter()
        total_time_ms = (end_time - start_time) * 1000

        assert total_time_ms < 1.0, (
            f"Processing empty sources took {total_time_ms:.4f}ms, "
            f"which exceeds the 1ms target"
        )

        print("\nEmpty sources performance:")
        print(f"  Total time: {total_time_ms:.4f}ms")
        print(f"  Chunk count: {chunk_count}")
