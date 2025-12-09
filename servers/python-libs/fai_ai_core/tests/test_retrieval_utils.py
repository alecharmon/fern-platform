from fai_ai_core.retrieval.interface import RetrievedDocument
from fai_ai_core.retrieval.utils import (
    Citation,
    deduplicate_documents,
    extract_citations,
    format_citations,
)


class TestCitation:
    def test_create_citation_with_url(self) -> None:
        citation = Citation(content="test content", url="https://example.com")
        assert citation.content == "test content"
        assert citation.url == "https://example.com"

    def test_create_citation_without_url(self) -> None:
        citation = Citation(content="test content")
        assert citation.content == "test content"
        assert citation.url is None

    def test_format_with_url(self) -> None:
        citation = Citation(content="test content", url="https://example.com")
        assert citation.format() == "test content\nSource: https://example.com"

    def test_format_without_url(self) -> None:
        citation = Citation(content="test content")
        assert citation.format() == "test content"


class TestDeduplicateDocuments:
    def test_empty_input(self) -> None:
        result = deduplicate_documents([])
        assert result == []

    def test_single_document(self) -> None:
        doc = RetrievedDocument(content="test", score=0.9)
        result = deduplicate_documents([[doc]])
        assert len(result) == 1
        assert result[0].content == "test"

    def test_deduplicate_by_id(self) -> None:
        doc1 = RetrievedDocument(content="test", score=0.9, document_id="doc1")
        doc2 = RetrievedDocument(content="test", score=0.8, document_id="doc1")
        result = deduplicate_documents([[doc1, doc2]])
        assert len(result) == 1
        assert result[0].score == 0.9

    def test_deduplicate_by_id_keeps_higher_score(self) -> None:
        doc1 = RetrievedDocument(content="test", score=0.7, document_id="doc1")
        doc2 = RetrievedDocument(content="test", score=0.9, document_id="doc1")
        result = deduplicate_documents([[doc1, doc2]])
        assert len(result) == 1
        assert result[0].score == 0.9

    def test_deduplicate_by_url(self) -> None:
        doc1 = RetrievedDocument(
            content="content1", score=0.9, document_id="id1", metadata={"url": "https://example.com"}
        )
        doc2 = RetrievedDocument(
            content="content2", score=0.8, document_id="id2", metadata={"url": "https://example.com"}
        )
        result = deduplicate_documents([[doc1, doc2]])
        assert len(result) == 1
        assert result[0].score == 0.9

    def test_deduplicate_by_url_keeps_higher_score(self) -> None:
        doc1 = RetrievedDocument(
            content="content1", score=0.7, document_id="id1", metadata={"url": "https://example.com"}
        )
        doc2 = RetrievedDocument(
            content="content2", score=0.9, document_id="id2", metadata={"url": "https://example.com"}
        )
        result = deduplicate_documents([[doc1, doc2]])
        assert len(result) == 1
        assert result[0].score == 0.9

    def test_documents_without_url_not_deduplicated(self) -> None:
        doc1 = RetrievedDocument(content="content1", score=0.9, document_id="id1")
        doc2 = RetrievedDocument(content="content2", score=0.8, document_id="id2")
        result = deduplicate_documents([[doc1, doc2]])
        assert len(result) == 2

    def test_multiple_result_lists(self) -> None:
        doc1 = RetrievedDocument(content="test1", score=0.9, document_id="doc1")
        doc2 = RetrievedDocument(content="test2", score=0.8, document_id="doc2")
        doc3 = RetrievedDocument(content="test1", score=0.7, document_id="doc1")
        result = deduplicate_documents([[doc1], [doc2, doc3]])
        assert len(result) == 2

    def test_fallback_to_content_prefix_for_id(self) -> None:
        doc1 = RetrievedDocument(content="same content prefix here and more", score=0.9)
        doc2 = RetrievedDocument(content="same content prefix here and more", score=0.7)
        result = deduplicate_documents([[doc1, doc2]])
        assert len(result) == 1
        assert result[0].score == 0.9


class TestExtractCitations:
    def test_empty_documents(self) -> None:
        result = extract_citations([])
        assert result == []

    def test_document_with_url(self) -> None:
        doc = RetrievedDocument(content="test content", score=0.9, metadata={"url": "https://example.com"})
        result = extract_citations([doc])
        assert len(result) == 1
        assert result[0].content == "test content"
        assert result[0].url == "https://example.com"

    def test_document_without_url(self) -> None:
        doc = RetrievedDocument(content="test content", score=0.9)
        result = extract_citations([doc])
        assert len(result) == 1
        assert result[0].content == "test content"
        assert result[0].url is None

    def test_document_with_empty_metadata(self) -> None:
        doc = RetrievedDocument(content="test content", score=0.9, metadata={})
        result = extract_citations([doc])
        assert len(result) == 1
        assert result[0].content == "test content"
        assert result[0].url is None

    def test_multiple_documents(self) -> None:
        docs = [
            RetrievedDocument(content="content1", score=0.9, metadata={"url": "https://example.com/1"}),
            RetrievedDocument(content="content2", score=0.8, metadata={"url": "https://example.com/2"}),
            RetrievedDocument(content="content3", score=0.7),
        ]
        result = extract_citations(docs)
        assert len(result) == 3
        assert result[0].url == "https://example.com/1"
        assert result[1].url == "https://example.com/2"
        assert result[2].url is None


class TestFormatCitations:
    def test_empty_citations(self) -> None:
        result = format_citations([])
        assert result == []

    def test_citations_with_urls(self) -> None:
        citations = [
            Citation(content="content1", url="https://example.com/1"),
            Citation(content="content2", url="https://example.com/2"),
        ]
        result = format_citations(citations)
        assert len(result) == 2
        assert result[0] == "content1\nSource: https://example.com/1"
        assert result[1] == "content2\nSource: https://example.com/2"

    def test_citations_without_urls(self) -> None:
        citations = [Citation(content="content1"), Citation(content="content2")]
        result = format_citations(citations)
        assert len(result) == 2
        assert result[0] == "content1"
        assert result[1] == "content2"

    def test_mixed_citations(self) -> None:
        citations = [
            Citation(content="content1", url="https://example.com"),
            Citation(content="content2"),
        ]
        result = format_citations(citations)
        assert len(result) == 2
        assert result[0] == "content1\nSource: https://example.com"
        assert result[1] == "content2"
