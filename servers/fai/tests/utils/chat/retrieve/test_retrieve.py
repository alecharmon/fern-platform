"""Unit tests for retrieve.py to ensure top_k is respected across all modes."""

from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest
from turbopuffer.types.row import Row

from fai.utils.chat.retrieve.retrieve import retrieve


def create_mock_row(row_id: str, score: float = 0.9) -> Row:
    class MockRow:
        def __init__(self, row_id: str, score: float):
            self.id = row_id
            self.score = score

    return MockRow(row_id, score)  # type: ignore


@pytest.mark.asyncio
async def test_retrieve_semantic_mode_respects_top_k() -> None:
    top_k = 2
    mock_semantic_rows = [
        create_mock_row("sem_1", 0.95),
        create_mock_row("sem_2", 0.90),
        create_mock_row("sem_3", 0.85),
        create_mock_row("sem_4", 0.80),
    ]

    with (
        patch("fai.utils.chat.retrieve.retrieve.AsyncOpenAI") as mock_openai,
        patch("fai.utils.chat.retrieve.retrieve.AsyncTurbopuffer") as mock_tpuf,
        patch("fai.utils.chat.retrieve.retrieve.get_query_index_name", return_value="query_index"),
        patch("fai.utils.chat.retrieve.retrieve.get_tpuf_namespace", return_value="test.namespace"),
        patch("fai.utils.chat.retrieve.retrieve.build_filters", return_value=None),
    ):
        mock_openai_instance = AsyncMock()
        mock_openai.return_value.__aenter__.return_value = mock_openai_instance
        mock_embedding_response = MagicMock()
        mock_embedding_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai_instance.embeddings.create = AsyncMock(return_value=mock_embedding_response)

        mock_tpuf_instance = MagicMock()
        mock_tpuf.return_value.__aenter__.return_value = mock_tpuf_instance
        mock_namespace = MagicMock()
        mock_tpuf_instance.namespace.return_value = mock_namespace

        mock_query_response = MagicMock()
        mock_query_response.rows = mock_semantic_rows
        mock_namespace.query = AsyncMock(return_value=mock_query_response)

        results = await retrieve(
            query="test query",
            domain="test.domain.com",
            top_k=top_k,
            mode="semantic",
        )

        assert len(results) == top_k, f"Expected {top_k} results, got {len(results)}"
        assert results[0].id == "sem_1"
        assert results[1].id == "sem_2"


@pytest.mark.asyncio
async def test_retrieve_bm25_mode_respects_top_k() -> None:
    top_k = 2
    mock_bm25_rows = [
        create_mock_row("bm25_1", 0.92),
        create_mock_row("bm25_2", 0.88),
        create_mock_row("bm25_3", 0.84),
        create_mock_row("bm25_4", 0.80),
        create_mock_row("bm25_5", 0.75),
    ]

    with (
        patch("fai.utils.chat.retrieve.retrieve.AsyncOpenAI") as mock_openai,
        patch("fai.utils.chat.retrieve.retrieve.AsyncTurbopuffer") as mock_tpuf,
        patch("fai.utils.chat.retrieve.retrieve.get_query_index_name", return_value="query_index"),
        patch("fai.utils.chat.retrieve.retrieve.get_tpuf_namespace", return_value="test.namespace"),
        patch("fai.utils.chat.retrieve.retrieve.build_filters", return_value=None),
    ):
        mock_openai_instance = AsyncMock()
        mock_openai.return_value.__aenter__.return_value = mock_openai_instance

        mock_tpuf_instance = MagicMock()
        mock_tpuf.return_value.__aenter__.return_value = mock_tpuf_instance
        mock_namespace = MagicMock()
        mock_tpuf_instance.namespace.return_value = mock_namespace

        mock_query_response = MagicMock()
        mock_query_response.rows = mock_bm25_rows
        mock_namespace.query = AsyncMock(return_value=mock_query_response)

        results = await retrieve(
            query="test query",
            domain="test.domain.com",
            top_k=top_k,
            mode="bm25",
        )

        assert len(results) == top_k, f"Expected {top_k} results, got {len(results)}"
        assert results[0].id == "bm25_1"
        assert results[1].id == "bm25_2"


@pytest.mark.asyncio
async def test_retrieve_hybrid_mode_respects_top_k() -> None:
    top_k = 2
    mock_semantic_rows = [
        create_mock_row("sem_1", 0.95),
        create_mock_row("sem_2", 0.90),
        create_mock_row("shared_1", 0.85),
    ]
    mock_bm25_rows = [
        create_mock_row("bm25_1", 0.92),
        create_mock_row("bm25_2", 0.88),
        create_mock_row("shared_1", 0.86),
    ]

    with (
        patch("fai.utils.chat.retrieve.retrieve.AsyncOpenAI") as mock_openai,
        patch("fai.utils.chat.retrieve.retrieve.AsyncTurbopuffer") as mock_tpuf,
        patch("fai.utils.chat.retrieve.retrieve.get_query_index_name", return_value="query_index"),
        patch("fai.utils.chat.retrieve.retrieve.get_tpuf_namespace", return_value="test.namespace"),
        patch("fai.utils.chat.retrieve.retrieve.build_filters", return_value=None),
    ):
        mock_openai_instance = AsyncMock()
        mock_openai.return_value.__aenter__.return_value = mock_openai_instance
        mock_embedding_response = MagicMock()
        mock_embedding_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai_instance.embeddings.create = AsyncMock(return_value=mock_embedding_response)

        mock_tpuf_instance = MagicMock()
        mock_tpuf.return_value.__aenter__.return_value = mock_tpuf_instance
        mock_namespace = MagicMock()
        mock_tpuf_instance.namespace.return_value = mock_namespace

        call_count = 0

        async def mock_query_side_effect(*args, **kwargs) -> MagicMock:  # type: ignore
            nonlocal call_count
            call_count += 1
            mock_response = MagicMock()
            if call_count == 1:
                mock_response.rows = mock_semantic_rows
            else:
                mock_response.rows = mock_bm25_rows
            return mock_response

        mock_namespace.query = AsyncMock(side_effect=mock_query_side_effect)

        results = await retrieve(
            query="test query",
            domain="test.domain.com",
            top_k=top_k,
            mode="hybrid",
        )

        assert len(results) == top_k, f"Expected {top_k} results, got {len(results)}"

        assert all(hasattr(r, "id") for r in results)


@pytest.mark.asyncio
async def test_retrieve_hybrid_mode_with_no_overlap() -> None:
    top_k = 2
    mock_semantic_rows = [
        create_mock_row("sem_1", 0.95),
        create_mock_row("sem_2", 0.90),
    ]
    mock_bm25_rows = [
        create_mock_row("bm25_1", 0.92),
        create_mock_row("bm25_2", 0.88),
    ]

    with (
        patch("fai.utils.chat.retrieve.retrieve.AsyncOpenAI") as mock_openai,
        patch("fai.utils.chat.retrieve.retrieve.AsyncTurbopuffer") as mock_tpuf,
        patch("fai.utils.chat.retrieve.retrieve.get_query_index_name", return_value="query_index"),
        patch("fai.utils.chat.retrieve.retrieve.get_tpuf_namespace", return_value="test.namespace"),
        patch("fai.utils.chat.retrieve.retrieve.build_filters", return_value=None),
    ):
        mock_openai_instance = AsyncMock()
        mock_openai.return_value.__aenter__.return_value = mock_openai_instance
        mock_embedding_response = MagicMock()
        mock_embedding_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai_instance.embeddings.create = AsyncMock(return_value=mock_embedding_response)

        mock_tpuf_instance = MagicMock()
        mock_tpuf.return_value.__aenter__.return_value = mock_tpuf_instance
        mock_namespace = MagicMock()
        mock_tpuf_instance.namespace.return_value = mock_namespace

        call_count = 0

        async def mock_query_side_effect(*args, **kwargs) -> MagicMock:  # type: ignore
            nonlocal call_count
            call_count += 1
            mock_response = MagicMock()
            if call_count == 1:
                mock_response.rows = mock_semantic_rows
            else:
                mock_response.rows = mock_bm25_rows
            return mock_response

        mock_namespace.query = AsyncMock(side_effect=mock_query_side_effect)

        results = await retrieve(
            query="test query",
            domain="test.domain.com",
            top_k=top_k,
            mode="hybrid",
        )

        assert len(results) == top_k, f"Expected {top_k} results, got {len(results)} (would be 4 without fix)"


@pytest.mark.asyncio
async def test_retrieve_hybrid_mode_with_complete_overlap() -> None:
    top_k = 2
    shared_rows = [
        create_mock_row("shared_1", 0.95),
        create_mock_row("shared_2", 0.90),
        create_mock_row("shared_3", 0.85),
    ]

    with (
        patch("fai.utils.chat.retrieve.retrieve.AsyncOpenAI") as mock_openai,
        patch("fai.utils.chat.retrieve.retrieve.AsyncTurbopuffer") as mock_tpuf,
        patch("fai.utils.chat.retrieve.retrieve.get_query_index_name", return_value="query_index"),
        patch("fai.utils.chat.retrieve.retrieve.get_tpuf_namespace", return_value="test.namespace"),
        patch("fai.utils.chat.retrieve.retrieve.build_filters", return_value=None),
    ):
        mock_openai_instance = AsyncMock()
        mock_openai.return_value.__aenter__.return_value = mock_openai_instance
        mock_embedding_response = MagicMock()
        mock_embedding_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai_instance.embeddings.create = AsyncMock(return_value=mock_embedding_response)

        mock_tpuf_instance = MagicMock()
        mock_tpuf.return_value.__aenter__.return_value = mock_tpuf_instance
        mock_namespace = MagicMock()
        mock_tpuf_instance.namespace.return_value = mock_namespace

        mock_query_response = MagicMock()
        mock_query_response.rows = shared_rows
        mock_namespace.query = AsyncMock(return_value=mock_query_response)

        results = await retrieve(
            query="test query",
            domain="test.domain.com",
            top_k=top_k,
            mode="hybrid",
        )

        assert len(results) == top_k, f"Expected {top_k} results, got {len(results)}"

        result_ids = {r.id for r in results}
        assert result_ids == {"shared_1", "shared_2"}
