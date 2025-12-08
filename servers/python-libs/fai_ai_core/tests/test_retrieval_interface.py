import pytest

from fai_ai_core.retrieval.filters import QueryFilters
from fai_ai_core.retrieval.interface import (
    RAGRetriever,
    RetrievalQuery,
    RetrievalResult,
    RetrievalStrategy,
    RetrievedDocument,
)


class TestRetrievedDocument:
    def test_create_valid_document(self) -> None:
        doc = RetrievedDocument(
            content="test content",
            score=0.95,
            metadata={"title": "Test"},
            document_id="123",
        )
        assert doc.content == "test content"
        assert doc.score == 0.95
        assert doc.metadata == {"title": "Test"}
        assert doc.document_id == "123"

    def test_empty_content_raises_error(self) -> None:
        with pytest.raises(ValueError, match="Document content cannot be empty"):
            RetrievedDocument(content="", score=0.95)

    def test_minimal_document(self) -> None:
        doc = RetrievedDocument(content="test", score=0.5)
        assert doc.content == "test"
        assert doc.score == 0.5
        assert doc.metadata is None
        assert doc.document_id is None


class TestRetrievalQuery:
    def test_create_valid_query(self) -> None:
        query = RetrievalQuery(
            query="test query",
            domain="example.com",
            top_k=10,
            strategy=RetrievalStrategy.SEMANTIC,
        )
        assert query.query == "test query"
        assert query.domain == "example.com"
        assert query.top_k == 10
        assert query.strategy == RetrievalStrategy.SEMANTIC

    def test_default_values(self) -> None:
        query = RetrievalQuery(query="test", domain="example.com")
        assert query.top_k == 5
        assert query.strategy == RetrievalStrategy.HYBRID
        assert query.filters is None
        assert query.min_score is None

    def test_empty_query_raises_error(self) -> None:
        with pytest.raises(ValueError, match="Query cannot be empty"):
            RetrievalQuery(query="", domain="example.com")

    def test_negative_top_k_raises_error(self) -> None:
        with pytest.raises(ValueError, match="top_k must be positive"):
            RetrievalQuery(query="test", domain="example.com", top_k=0)

    def test_with_filters(self) -> None:
        query = RetrievalQuery(
            query="test",
            domain="example.com",
            filters=QueryFilters(facet_filters=[{"field": "type", "value": "api"}]),
        )
        assert query.filters == QueryFilters(facet_filters=[{"field": "type", "value": "api"}])


class TestRetrievalResult:
    def test_create_result(self) -> None:
        query = RetrievalQuery(query="test", domain="example.com")
        docs = [
            RetrievedDocument(content="doc1", score=0.9),
            RetrievedDocument(content="doc2", score=0.8),
        ]
        result = RetrievalResult(
            documents=docs,
            query=query,
            retrieval_time_ms=150.5,
            total_results=2,
        )
        assert len(result.documents) == 2
        assert result.query == query
        assert result.retrieval_time_ms == 150.5
        assert result.total_results == 2

    def test_is_empty_property(self) -> None:
        query = RetrievalQuery(query="test", domain="example.com")
        empty_result = RetrievalResult(documents=[], query=query)
        assert empty_result.is_empty is True

        non_empty_result = RetrievalResult(
            documents=[RetrievedDocument(content="test", score=0.5)],
            query=query,
        )
        assert non_empty_result.is_empty is False

    def test_filter_by_score(self) -> None:
        query = RetrievalQuery(query="test", domain="example.com")
        docs = [
            RetrievedDocument(content="doc1", score=0.9),
            RetrievedDocument(content="doc2", score=0.7),
            RetrievedDocument(content="doc3", score=0.5),
        ]
        result = RetrievalResult(documents=docs, query=query, total_results=3)

        filtered = result.filter_by_score(0.6)
        assert len(filtered.documents) == 2
        assert filtered.documents[0].score == 0.9
        assert filtered.documents[1].score == 0.7
        assert filtered.total_results == 2


class TestRetrievalStrategy:
    def test_strategy_values(self) -> None:
        assert RetrievalStrategy.SEMANTIC == "semantic"
        assert RetrievalStrategy.BM25 == "bm25"
        assert RetrievalStrategy.HYBRID == "hybrid"


class TestRAGRetriever:
    def test_is_abstract(self) -> None:
        with pytest.raises(TypeError):
            RAGRetriever()  # type: ignore[abstract]
