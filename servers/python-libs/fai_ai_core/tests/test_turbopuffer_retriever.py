from typing import Any
from unittest.mock import (
    AsyncMock,
    MagicMock,
)

import pytest

from fai_ai_core.embeddings.interface import (
    EmbeddingError,
    EmbeddingsGenerator,
)
from fai_ai_core.retrieval.filters import QueryFilters
from fai_ai_core.retrieval.interface import (
    RetrievalQuery,
    RetrievalStrategy,
)
from fai_ai_core.retrieval.turbopuffer_retriever import (
    TurbopufferRetriever,
    _extract_context_window,
)


class MockEmbeddingsGenerator(EmbeddingsGenerator):
    async def generate(self, text: str) -> list[float]:
        return [0.1] * 1536

    async def generate_batch(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * 1536 for _ in texts]

    async def __aenter__(self) -> "MockEmbeddingsGenerator":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()

    async def close(self) -> None:
        pass


class MockTurbopufferRow:
    def __init__(
        self,
        document: str,
        title: str | None = None,
        url: str | None = None,
        dist: float = 0.5,
        row_id: int = 1,
        chunk: str | None = None,
    ) -> None:
        self.document = document
        self.chunk = chunk
        self.title = title
        self.url = url
        self.id = row_id
        setattr(self, "$dist", dist)


class MockTurbopufferResult:
    def __init__(self, rows: list[MockTurbopufferRow]) -> None:
        self.rows = rows


class MockMultiQueryResponse:
    def __init__(self, results: list[MockTurbopufferResult]) -> None:
        self.results = results


@pytest.fixture
def retriever() -> TurbopufferRetriever:
    return TurbopufferRetriever(
        turbopuffer_api_key="test_tpuf_key",
        embeddings_generator=MockEmbeddingsGenerator(),
        region="us-east-1",
    )


@pytest.fixture
def sample_query() -> RetrievalQuery:
    return RetrievalQuery(
        query="What is Python?",
        domain="example.com",
        top_k=3,
        strategy=RetrievalStrategy.SEMANTIC,
    )


class TestTurbopufferRetriever:
    def test_initialization(self, retriever: TurbopufferRetriever) -> None:
        assert retriever.turbopuffer_api_key == "test_tpuf_key"
        assert isinstance(retriever.embeddings_generator, MockEmbeddingsGenerator)
        assert retriever.region == "us-east-1"

    @pytest.mark.asyncio
    async def test_semantic_retrieve_success(
        self, retriever: TurbopufferRetriever, sample_query: RetrievalQuery
    ) -> None:
        mock_rows = [
            MockTurbopufferRow(
                document="Python is a programming language",
                title="Python Intro",
                url="https://example.com/python",
                dist=0.9,
                row_id=1,
            ),
            MockTurbopufferRow(
                document="Python is interpreted",
                title="Python Features",
                url="https://example.com/features",
                dist=0.8,
                row_id=2,
            ),
        ]

        mock_namespace = MagicMock()
        retriever._client.namespace = MagicMock(return_value=mock_namespace)
        mock_namespace.query = AsyncMock(return_value=MockTurbopufferResult(mock_rows))

        result = await retriever.retrieve(sample_query)

        assert len(result.documents) == 2
        assert result.documents[0].content == "Python is a programming language"
        assert result.documents[0].metadata is not None
        assert result.documents[0].metadata["title"] == "Python Intro"
        assert result.documents[0].metadata["url"] == "https://example.com/python"
        assert result.documents[0].score == 0.9
        assert result.retrieval_time_ms is not None
        assert result.total_results == 2

    @pytest.mark.asyncio
    async def test_bm25_retrieve_success(self, retriever: TurbopufferRetriever) -> None:
        query = RetrievalQuery(
            query="Python programming",
            domain="example.com",
            strategy=RetrievalStrategy.BM25,
        )

        mock_rows = [
            MockTurbopufferRow(
                document="Python is great",
                title="Python",
                dist=0.85,
            ),
        ]

        mock_namespace = MagicMock()
        retriever._client.namespace = MagicMock(return_value=mock_namespace)
        mock_namespace.query = AsyncMock(return_value=MockTurbopufferResult(mock_rows))

        result = await retriever.retrieve(query)

        assert len(result.documents) == 1
        assert result.documents[0].content == "Python is great"
        assert result.documents[0].metadata is not None
        assert result.documents[0].metadata["title"] == "Python"
        assert result.documents[0].score == 0.85

    @pytest.mark.asyncio
    async def test_batch_retrieve_too_many_queries(self, retriever: TurbopufferRetriever) -> None:
        queries = [
            RetrievalQuery(
                query=f"query {i}",
                domain="example.com",
                strategy=RetrievalStrategy.SEMANTIC,
            )
            for i in range(17)
        ]

        with pytest.raises(ValueError, match="Cannot batch retrieve more than 16 queries"):
            await retriever.batch_retrieve(queries)

    @pytest.mark.asyncio
    async def test_hybrid_retrieve_success(self, retriever: TurbopufferRetriever) -> None:
        query = RetrievalQuery(
            query="Python",
            domain="example.com",
            strategy=RetrievalStrategy.HYBRID,
            top_k=2,
        )

        mock_semantic_rows = [
            MockTurbopufferRow(document="doc1", dist=0.9),
            MockTurbopufferRow(document="doc2", dist=0.8),
        ]
        mock_bm25_rows = [
            MockTurbopufferRow(document="doc1", dist=0.85),
            MockTurbopufferRow(document="doc3", dist=0.75),
        ]

        mock_multi_response = MockMultiQueryResponse(
            [
                MockTurbopufferResult(mock_semantic_rows),
                MockTurbopufferResult(mock_bm25_rows),
            ]
        )

        mock_namespace = MagicMock()
        retriever._client.namespace = MagicMock(return_value=mock_namespace)
        mock_namespace.multi_query = AsyncMock(return_value=mock_multi_response)

        result = await retriever.retrieve(query)

        assert len(result.documents) <= 2
        assert result.retrieval_time_ms is not None
        assert result.total_results == len(result.documents)

    @pytest.mark.asyncio
    async def test_embedding_error_handling(self, sample_query: RetrievalQuery) -> None:
        mock_embeddings = AsyncMock()
        mock_embeddings.generate = AsyncMock(side_effect=EmbeddingError("Embedding error"))

        error_retriever = TurbopufferRetriever(
            turbopuffer_api_key="test_key",
            embeddings_generator=mock_embeddings,
            region="us-east-1",
        )

        with pytest.raises(EmbeddingError):
            await error_retriever.retrieve(sample_query)

    @pytest.mark.asyncio
    async def test_min_score_filtering(self, retriever: TurbopufferRetriever) -> None:
        query = RetrievalQuery(
            query="test",
            domain="example.com",
            strategy=RetrievalStrategy.SEMANTIC,
            min_score=0.85,
        )

        mock_rows = [
            MockTurbopufferRow(document="high score", dist=0.9),
            MockTurbopufferRow(document="low score", dist=0.7),
        ]

        mock_namespace = MagicMock()
        retriever._client.namespace = MagicMock(return_value=mock_namespace)
        mock_namespace.query = AsyncMock(return_value=MockTurbopufferResult(mock_rows))

        result = await retriever.retrieve(query)

        assert len(result.documents) == 1
        assert result.documents[0].content == "high score"

    @pytest.mark.asyncio
    async def test_batch_retrieve(self, retriever: TurbopufferRetriever) -> None:
        queries = [
            RetrievalQuery(
                query="Python",
                domain="example.com",
                strategy=RetrievalStrategy.SEMANTIC,
            ),
            RetrievalQuery(
                query="JavaScript",
                domain="example.com",
                strategy=RetrievalStrategy.SEMANTIC,
            ),
        ]

        mock_multi_response = MockMultiQueryResponse(
            [
                MockTurbopufferResult([MockTurbopufferRow(document="Python doc")]),
                MockTurbopufferResult([MockTurbopufferRow(document="JavaScript doc")]),
            ]
        )

        mock_namespace = MagicMock()
        retriever._client.namespace = MagicMock(return_value=mock_namespace)
        mock_namespace.multi_query = AsyncMock(return_value=mock_multi_response)

        results = await retriever.batch_retrieve(queries)

        assert len(results) == 2
        assert results[0].documents[0].content == "Python doc"
        assert results[1].documents[0].content == "JavaScript doc"

    def test_build_filters_with_query_filters(self, retriever: TurbopufferRetriever) -> None:
        filters = QueryFilters(
            facet_filters=[
                {"field": "version.title", "value": "v1"},
                {"field": "product.title", "value": "productA"},
            ],
            document_ids_to_ignore=["doc1", "doc2"],
            urls_to_ignore=["url1", "url2"],
            exploded_roles=["admin"],
            document_urls=["url3", "url4"],
            user_is_authed=False,
        )

        result = retriever._build_filters(filters)

        assert result is not None
        assert isinstance(result, tuple)

    def test_build_filters_none(self, retriever: TurbopufferRetriever) -> None:
        result = retriever._build_filters(None)
        assert result is None

    def test_rrf_with_identical_documents(self, retriever: TurbopufferRetriever) -> None:
        doc1 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult([MockTurbopufferRow("doc1", dist=0.9, row_id=1)])
        )
        doc2 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult([MockTurbopufferRow("doc1", dist=0.8, row_id=1)])
        )

        fused = retriever._reciprocal_rank_fusion(doc1, doc2, k=1)

        assert len(fused) == 1
        assert fused[0].content == "doc1"

    def test_rrf_with_different_documents(self, retriever: TurbopufferRetriever) -> None:
        list1 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc1", dist=0.9, row_id=1), MockTurbopufferRow("doc2", dist=0.8, row_id=2)]
            )
        )
        list2 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc3", dist=0.85, row_id=3), MockTurbopufferRow("doc4", dist=0.75, row_id=4)]
            )
        )

        fused = retriever._reciprocal_rank_fusion(list1, list2, k=2)

        assert len(fused) == 2
        assert {doc.content for doc in fused} == {"doc1", "doc3"}

    def test_rrf_with_overlapping_documents(self, retriever: TurbopufferRetriever) -> None:
        list1 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc1", dist=0.9, row_id=1), MockTurbopufferRow("doc2", dist=0.8, row_id=2)]
            )
        )
        list2 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc2", dist=0.85, row_id=2), MockTurbopufferRow("doc3", dist=0.75, row_id=3)]
            )
        )

        fused = retriever._reciprocal_rank_fusion(list1, list2, k=3)

        assert len(fused) == 3
        assert {doc.content for doc in fused} == {"doc1", "doc2", "doc3"}

    def test_rrf_respects_k_limit(self, retriever: TurbopufferRetriever) -> None:
        list1 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc1", dist=0.9, row_id=1), MockTurbopufferRow("doc2", dist=0.8, row_id=2)]
            )
        )
        list2 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc3", dist=0.85, row_id=3), MockTurbopufferRow("doc4", dist=0.75, row_id=4)]
            )
        )

        fused = retriever._reciprocal_rank_fusion(list1, list2, k=1)

        assert len(fused) == 1

    def test_rrf_score_ordering(self, retriever: TurbopufferRetriever) -> None:
        list1 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc1", dist=0.9, row_id=1), MockTurbopufferRow("doc2", dist=0.8, row_id=2)]
            )
        )
        list2 = retriever._parse_turbopuffer_results(
            MockTurbopufferResult(
                [MockTurbopufferRow("doc2", dist=0.85, row_id=2), MockTurbopufferRow("doc3", dist=0.75, row_id=3)]
            )
        )

        fused = retriever._reciprocal_rank_fusion(list1, list2, k=3)

        assert fused[0].score >= fused[1].score >= fused[2].score

    def test_get_bm25_query_under_limit(self, retriever: TurbopufferRetriever) -> None:
        query = "short query"
        assert retriever._get_bm25_query(query) == query

    def test_get_bm25_query_at_limit(self, retriever: TurbopufferRetriever) -> None:
        query = "x" * 1024
        assert retriever._get_bm25_query(query) == query

    def test_get_bm25_query_over_limit_truncates_at_word_boundary(self, retriever: TurbopufferRetriever) -> None:
        query = "word " * 300
        truncated = retriever._get_bm25_query(query)
        assert len(truncated) <= 1024
        assert truncated.endswith("word")

    def test_get_bm25_query_over_limit_no_good_word_boundary(self, retriever: TurbopufferRetriever) -> None:
        query = "x" * 1200
        truncated = retriever._get_bm25_query(query)
        assert len(truncated) == 1024

    def test_get_bm25_query_over_limit_no_spaces(self, retriever: TurbopufferRetriever) -> None:
        query = "word" * 300
        truncated = retriever._get_bm25_query(query)
        assert len(truncated) == 1024


class TestExtractContextWindow:
    def test_no_chunk_returns_truncated_document(self) -> None:
        document = "A" * 1000
        result = _extract_context_window(document, None, 500)
        assert result == "A" * 500

    def test_empty_chunk_returns_truncated_document(self) -> None:
        document = "A" * 1000
        result = _extract_context_window(document, "", 500)
        assert result == "A" * 500

    def test_chunk_not_in_document_returns_truncated(self) -> None:
        document = "This is the document content"
        result = _extract_context_window(document, "not found", 100)
        assert result == document

    def test_chunk_at_start_returns_max_chars(self) -> None:
        document = "Chunk here. Then more content follows after."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 30)
        assert len(result) == 30
        assert result.startswith("Chunk here.")

    def test_chunk_in_middle_returns_max_chars(self) -> None:
        document = "Intro text. The matched chunk. More text after this."
        chunk = "The matched chunk."
        result = _extract_context_window(document, chunk, 40)
        assert len(result) == 40
        assert "The matched chunk." in result

    def test_chunk_exceeds_max_chars_returns_full_chunk(self) -> None:
        chunk = "A" * 500
        document = f"Prefix{chunk}Suffix"
        result = _extract_context_window(document, chunk, 100)
        assert result == chunk

    def test_chunk_near_end_includes_preceding_context(self) -> None:
        document = "A" * 100 + "CHUNK" + "B" * 10
        chunk = "CHUNK"
        result = _extract_context_window(document, chunk, 50)
        assert len(result) == 50
        assert "CHUNK" in result
        assert result.endswith("B" * 10)

    def test_preserves_paragraph_boundary_when_trimming(self) -> None:
        document = "A" * 30 + "\n\nSecond paragraph.\n\nThe chunk is here. More text after chunk."
        chunk = "The chunk is here."
        result = _extract_context_window(document, chunk, 55)
        assert result.startswith("Second paragraph")
        assert "The chunk is here." in result

    def test_extends_to_code_block_end(self) -> None:
        document = "Some text. The chunk. ```python\ncode here\n``` After code."
        chunk = "The chunk."
        result = _extract_context_window(document, chunk, 35)
        assert "```python\ncode here\n```" in result

    def test_no_code_block_no_extension(self) -> None:
        document = "Some text. The chunk. More text after."
        chunk = "The chunk."
        result = _extract_context_window(document, chunk, 25)
        assert len(result) == 25

    def test_document_shorter_than_max_chars(self) -> None:
        document = "Short doc with chunk."
        chunk = "chunk"
        result = _extract_context_window(document, chunk, 1000)
        assert result == document

    def test_chunk_at_end_returns_max_chars(self) -> None:
        document = "A" * 50 + "The chunk at end."
        chunk = "The chunk at end."
        result = _extract_context_window(document, chunk, 40)
        assert len(result) == 40
        assert result.endswith("The chunk at end.")


class TestCodeBlockExtension:
    def test_code_block_at_end_extends_to_closing_fence(self) -> None:
        document = "Text before. Chunk here. ```python\nprint('hello')\n```"
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 30)
        assert result.endswith("```")
        assert "print('hello')" in result

    def test_code_block_already_closed_no_extension(self) -> None:
        document = "```python\ncode\n``` Chunk here. More text."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 25)
        assert len(result) == 25

    def test_unclosed_code_block_extends_to_document_end(self) -> None:
        document = "Text. Chunk. ```python\ncode without closing"
        chunk = "Chunk."
        result = _extract_context_window(document, chunk, 50)
        assert result == document

    def test_nested_code_fences_handled(self) -> None:
        document = "Text. Chunk. ```\ncode\n``` more ```\ninner\n``` end"
        chunk = "Chunk."
        result = _extract_context_window(document, chunk, 25)
        assert "```\ncode\n```" in result

    def test_code_block_with_language_specifier(self) -> None:
        document = "Intro. Chunk. ```javascript\nconst x = 1;\n``` After."
        chunk = "Chunk."
        result = _extract_context_window(document, chunk, 30)
        assert "```javascript" in result
        assert result.count("```") == 2

    def test_no_code_fence_before_end_returns_normal(self) -> None:
        document = "Plain text without any code. Chunk here. More plain text."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 40)
        assert len(result) == 40
        assert "```" not in result

    def test_code_block_entirely_before_window_no_extension(self) -> None:
        document = "```py\nold code\n```" + "A" * 100 + "Chunk." + "B" * 50
        chunk = "Chunk."
        result = _extract_context_window(document, chunk, 40)
        assert len(result) == 40
        assert "old code" not in result


class TestParagraphBoundaryAlignment:
    def test_multiple_paragraph_boundaries_uses_first_in_range(self) -> None:
        document = "Para1.\n\nPara2.\n\nPara3.\n\nChunk here. After."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 30)
        assert result.startswith("Para2.")
        assert "Chunk here." in result

    def test_no_paragraph_boundary_in_range_uses_calculated_start(self) -> None:
        document = "A" * 100 + "Chunk here." + "B" * 50
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 50)
        assert len(result) == 50
        assert "Chunk here." in result

    def test_paragraph_boundary_exactly_at_start_position(self) -> None:
        document = "X" * 37 + "\n\nChunk here. More text after this."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 35)
        assert result.startswith("Chunk here.")

    def test_paragraph_boundary_just_before_chunk(self) -> None:
        document = "A" * 40 + "\n\nChunk here. Text after chunk."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 35)
        assert result.startswith("Chunk here.")

    def test_single_newline_not_treated_as_paragraph(self) -> None:
        document = "A" * 40 + "\nChunk here. More text after."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 35)
        assert not result.startswith("Chunk")
        assert "Chunk here." in result

    def test_paragraph_boundary_far_before_chunk_ignored(self) -> None:
        document = "Para1.\n\n" + "A" * 200 + "Chunk here. After."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, 50)
        assert "Para1" not in result
        assert "Chunk here." in result


class TestEdgeCases:
    def test_chunk_is_entire_document(self) -> None:
        document = "This is the entire document."
        chunk = document
        result = _extract_context_window(document, chunk, 100)
        assert result == document

    def test_chunk_at_exact_document_start(self) -> None:
        document = "Chunk at start. Rest of document here."
        chunk = "Chunk at start."
        result = _extract_context_window(document, chunk, 50)
        assert result.startswith("Chunk at start.")
        assert len(result) <= 50

    def test_chunk_at_exact_document_end(self) -> None:
        document = "Document content. Chunk at end."
        chunk = "Chunk at end."
        result = _extract_context_window(document, chunk, 50)
        assert result.endswith("Chunk at end.")

    def test_max_chars_equals_chunk_length(self) -> None:
        document = "Before. Chunk here. After."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, len(chunk))
        assert result == chunk

    def test_max_chars_one_more_than_chunk(self) -> None:
        document = "Before. Chunk here. After."
        chunk = "Chunk here."
        result = _extract_context_window(document, chunk, len(chunk) + 1)
        assert chunk in result
        assert len(result) == len(chunk) + 1

    def test_very_small_max_chars(self) -> None:
        document = "A" * 100 + "Chunk" + "B" * 100
        chunk = "Chunk"
        result = _extract_context_window(document, chunk, 5)
        assert result == chunk

    def test_chunk_appears_multiple_times_uses_first(self) -> None:
        document = "First CHUNK here. Middle. Second CHUNK here. End."
        chunk = "CHUNK here."
        result = _extract_context_window(document, chunk, 30)
        assert result.startswith("CHUNK here.")
        assert "Middle" in result
        assert "First" not in result

    def test_unicode_content_handled(self) -> None:
        document = "Héllo wörld. The chünk. Mōre tëxt."
        chunk = "The chünk."
        result = _extract_context_window(document, chunk, 25)
        assert "The chünk." in result

    def test_code_block_and_paragraph_boundary_combined(self) -> None:
        document = "Para1.\n\nPara2.\n\nChunk. ```py\ncode\n``` End."
        chunk = "Chunk."
        result = _extract_context_window(document, chunk, 30)
        assert "```py\ncode\n```" in result
        assert result.startswith("Para2.")
