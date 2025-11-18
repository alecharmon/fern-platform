from typing import Any
from unittest.mock import (
    AsyncMock,
    MagicMock,
)

import pytest

from src.embeddings.interface import (
    EmbeddingError,
    EmbeddingsGenerator,
)
from src.retrieval.interface import (
    RetrievalQuery,
    RetrievalStrategy,
)
from src.retrieval.turbopuffer_retriever import TurbopufferRetriever


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
    ) -> None:
        self.document = document
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


@pytest.mark.asyncio
class TestTurbopufferRetriever:
    async def test_initialization(self, retriever: TurbopufferRetriever) -> None:
        assert retriever.turbopuffer_api_key == "test_tpuf_key"
        assert isinstance(retriever.embeddings_generator, MockEmbeddingsGenerator)
        assert retriever.region == "us-east-1"

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
        assert result.documents[0].content in ["doc1", "doc2", "doc3"]

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
        assert results[0].retrieval_time_ms == results[1].retrieval_time_ms

    async def test_get_namespace(self, retriever: TurbopufferRetriever) -> None:
        namespace = retriever._get_namespace("example.com")
        assert namespace == "example.com_query"

    def test_build_filters(self, retriever: TurbopufferRetriever) -> None:
        filters = {"type": "api", "status": "published"}
        result = retriever._build_filters(filters)
        assert result is not None
        assert len(result) == 2
        assert ("type", "Eq", "api") in result
        assert ("status", "Eq", "published") in result

    def test_build_filters_none(self, retriever: TurbopufferRetriever) -> None:
        result = retriever._build_filters(None)
        assert result is None

    def test_rrf_with_identical_documents(self, retriever: TurbopufferRetriever) -> None:
        from src.retrieval.interface import RetrievedDocument

        doc1 = RetrievedDocument(
            content="same document",
            score=0.9,
            metadata={"source": "semantic"},
            document_id="doc1",
        )
        doc2 = RetrievedDocument(
            content="same document",
            score=0.8,
            metadata={"source": "bm25"},
            document_id="doc1",
        )

        list1 = [doc1]
        list2 = [doc2]

        result = retriever._reciprocal_rank_fusion(list1, list2, k=5)

        assert len(result) == 1
        assert result[0].content == "same document"
        expected_score = 1.0 / (60 + 1) + 1.0 / (60 + 1)
        assert abs(result[0].score - expected_score) < 0.0001

    def test_rrf_with_different_documents(self, retriever: TurbopufferRetriever) -> None:
        from src.retrieval.interface import RetrievedDocument

        doc1 = RetrievedDocument(content="first document", score=0.9, document_id="1")
        doc2 = RetrievedDocument(content="second document", score=0.85, document_id="2")
        doc3 = RetrievedDocument(content="third document", score=0.8, document_id="3")

        list1 = [doc1, doc2]
        list2 = [doc3]

        result = retriever._reciprocal_rank_fusion(list1, list2, k=5)

        assert len(result) == 3
        contents = [doc.content for doc in result]
        assert "first document" in contents
        assert "second document" in contents
        assert "third document" in contents

        assert abs(result[0].score - 1.0 / (60 + 1)) < 0.0001 or abs(result[1].score - 1.0 / (60 + 1)) < 0.0001

        second_doc = next(doc for doc in result if doc.content == "second document")
        assert abs(second_doc.score - 1.0 / (60 + 2)) < 0.0001

    def test_rrf_with_overlapping_documents(self, retriever: TurbopufferRetriever) -> None:
        from src.retrieval.interface import RetrievedDocument

        doc1 = RetrievedDocument(content="overlap document", score=0.95, document_id="overlap")
        doc2 = RetrievedDocument(content="unique to semantic", score=0.9, document_id="semantic_only")
        doc3 = RetrievedDocument(content="overlap document", score=0.85, document_id="overlap")
        doc4 = RetrievedDocument(content="unique to bm25", score=0.8, document_id="bm25_only")

        list1 = [doc1, doc2]
        list2 = [doc3, doc4]

        result = retriever._reciprocal_rank_fusion(list1, list2, k=5)

        assert len(result) == 3
        assert result[0].content == "overlap document"
        overlap_score = 1.0 / (60 + 1) + 1.0 / (60 + 1)
        assert abs(result[0].score - overlap_score) < 0.0001

    def test_rrf_respects_k_limit(self, retriever: TurbopufferRetriever) -> None:
        from src.retrieval.interface import RetrievedDocument

        list1 = [RetrievedDocument(content=f"doc{i}", score=0.9 - i * 0.1, document_id=str(i)) for i in range(10)]
        list2 = [
            RetrievedDocument(content=f"doc{i + 10}", score=0.8 - i * 0.1, document_id=str(i + 10)) for i in range(10)
        ]

        result = retriever._reciprocal_rank_fusion(list1, list2, k=3)

        assert len(result) == 3
        assert all(doc.score > 0 for doc in result)

    def test_rrf_score_ordering(self, retriever: TurbopufferRetriever) -> None:
        from src.retrieval.interface import RetrievedDocument

        doc_high_both = RetrievedDocument(content="high in both", score=0.95, document_id="high_both")
        doc_high_semantic = RetrievedDocument(content="high in semantic only", score=0.9, document_id="high_semantic")
        doc_low_both = RetrievedDocument(content="low in both", score=0.5, document_id="low_both")

        list1 = [doc_high_both, doc_high_semantic, doc_low_both]
        list2 = [doc_high_both, doc_low_both]

        result = retriever._reciprocal_rank_fusion(list1, list2, k=5)

        assert result[0].content == "high in both"
        high_both_score = 1.0 / (60 + 1) + 1.0 / (60 + 1)
        assert abs(result[0].score - high_both_score) < 0.0001

        assert result[1].content in ["high in semantic only", "low in both"]
        assert result[2].content in ["high in semantic only", "low in both"]
        assert result[1].content != result[2].content

        for i in range(len(result) - 1):
            assert result[i].score >= result[i + 1].score
