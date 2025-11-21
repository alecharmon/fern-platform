from unittest.mock import (
    AsyncMock,
    MagicMock,
)

import pytest

from src.retrieval.filters import QueryFilters
from src.retrieval.interface import (
    RetrievalQuery,
    RetrievalResult,
    RetrievalStrategy,
    RetrievedDocument,
)
from src.tools.documentation_search import create_documentation_search_tool


class TestDocumentationSearchTool:
    @pytest.mark.asyncio
    async def test_create_tool_with_defaults(self) -> None:
        mock_retriever = AsyncMock()
        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
        )

        assert tool.definition.name == "documentationSearch"
        assert tool.max_calls == 2
        assert len(tool.definition.parameters) == 1
        assert tool.definition.parameters[0].name == "query"

    @pytest.mark.asyncio
    async def test_create_tool_with_custom_max_calls(self) -> None:
        mock_retriever = AsyncMock()
        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
            max_calls=5,
        )

        assert tool.max_calls == 5

    @pytest.mark.asyncio
    async def test_execute_returns_formatted_documents(self) -> None:
        mock_retriever = AsyncMock()
        mock_doc = RetrievedDocument(
            content="Test content",
            score=0.9,
            metadata={
                "title": "Test Doc",
                "url": "https://test.com/doc",
                "product": "Test Product",
                "source": "test_source",
                "roles": ["everyone"],
                "authed": False,
            },
        )
        mock_result = RetrievalResult(
            documents=[mock_doc],
            query=MagicMock(),
        )
        mock_retriever.retrieve.return_value = mock_result

        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
            top_k=5,
        )

        result = await tool.execute({"query": "test query"})

        assert len(result) == 1
        assert result[0]["title"] == "Test Doc"
        assert result[0]["url"] == "https://test.com/doc"
        assert result[0]["document"] == "Test content"
        assert result[0]["product"] == "Test Product"
        assert result[0]["source"] == "test_source"

        mock_retriever.retrieve.assert_called_once()
        call_args = mock_retriever.retrieve.call_args[0][0]
        assert isinstance(call_args, RetrievalQuery)
        assert call_args.query == "test query"
        assert call_args.domain == "test.com"
        assert call_args.top_k == 5
        assert call_args.strategy == RetrievalStrategy.HYBRID

    @pytest.mark.asyncio
    async def test_execute_with_empty_query(self) -> None:
        mock_retriever = AsyncMock()
        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
        )

        result = await tool.execute({"query": ""})
        assert result == []
        mock_retriever.retrieve.assert_not_called()

    @pytest.mark.asyncio
    async def test_execute_with_missing_query(self) -> None:
        mock_retriever = AsyncMock()
        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
        )

        result = await tool.execute({})
        assert result == []
        mock_retriever.retrieve.assert_not_called()

    @pytest.mark.asyncio
    async def test_execute_returns_full_document(self) -> None:
        mock_retriever = AsyncMock()
        long_content = "x" * 1000
        mock_doc = RetrievedDocument(
            content=long_content,
            score=0.9,
            metadata={"title": "Long Doc", "url": "https://test.com/long"},
        )
        mock_result = RetrievalResult(
            documents=[mock_doc],
            query=MagicMock(),
        )
        mock_retriever.retrieve.return_value = mock_result

        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
        )

        result = await tool.execute({"query": "test"})

        assert len(result[0]["document"]) == 1000
        assert result[0]["title"] == "Long Doc"
        assert result[0]["url"] == "https://test.com/long"

    @pytest.mark.asyncio
    async def test_execute_with_filters(self) -> None:
        mock_retriever = AsyncMock()
        mock_retriever.retrieve.return_value = RetrievalResult(
            documents=[],
            query=MagicMock(),
        )

        filters = QueryFilters(
            facet_filters=[{"field": "product", "value": "test"}],
        )
        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
            filters=filters,
        )

        await tool.execute({"query": "test"})

        call_args = mock_retriever.retrieve.call_args[0][0]
        assert call_args.filters.facet_filters == filters.facet_filters

    @pytest.mark.asyncio
    async def test_excludes_already_retrieved_urls(self) -> None:
        mock_retriever = AsyncMock()
        mock_retriever.retrieve.return_value = RetrievalResult(
            documents=[],
            query=MagicMock(),
        )

        already_retrieved = {"https://test.com/doc1", "https://test.com/doc2"}
        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
            already_retrieved_urls=already_retrieved,
        )

        await tool.execute({"query": "test"})

        call_args = mock_retriever.retrieve.call_args[0][0]
        assert "https://test.com/doc1" in call_args.filters.urls_to_ignore
        assert "https://test.com/doc2" in call_args.filters.urls_to_ignore

    @pytest.mark.asyncio
    async def test_adds_retrieved_urls_to_ignore_list(self) -> None:
        mock_retriever = AsyncMock()
        mock_doc1 = RetrievedDocument(
            content="Content 1",
            score=0.9,
            metadata={"title": "Doc 1", "url": "https://test.com/new1"},
        )
        mock_doc2 = RetrievedDocument(
            content="Content 2",
            score=0.8,
            metadata={"title": "Doc 2", "url": "https://test.com/new2"},
        )
        mock_retriever.retrieve.return_value = RetrievalResult(
            documents=[mock_doc1, mock_doc2],
            query=MagicMock(),
        )

        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
        )

        await tool.execute({"query": "first query"})

        mock_retriever.retrieve.return_value = RetrievalResult(
            documents=[],
            query=MagicMock(),
        )

        await tool.execute({"query": "second query"})

        call_args = mock_retriever.retrieve.call_args[0][0]
        assert "https://test.com/new1" in call_args.filters.urls_to_ignore
        assert "https://test.com/new2" in call_args.filters.urls_to_ignore

    @pytest.mark.asyncio
    async def test_combines_initial_and_filter_urls_to_ignore(self) -> None:
        mock_retriever = AsyncMock()
        mock_retriever.retrieve.return_value = RetrievalResult(
            documents=[],
            query=MagicMock(),
        )

        filters = QueryFilters(
            urls_to_ignore=["https://existing.com/doc1"],
        )
        already_retrieved = {"https://initial.com/doc1"}

        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
            filters=filters,
            already_retrieved_urls=already_retrieved,
        )

        await tool.execute({"query": "test"})

        call_args = mock_retriever.retrieve.call_args[0][0]
        urls = call_args.filters.urls_to_ignore
        assert "https://existing.com/doc1" in urls
        assert "https://initial.com/doc1" in urls

    @pytest.mark.asyncio
    async def test_execute_handles_missing_metadata(self) -> None:
        mock_retriever = AsyncMock()
        mock_doc = RetrievedDocument(
            content="Content without metadata",
            score=0.8,
        )
        mock_result = RetrievalResult(
            documents=[mock_doc],
            query=MagicMock(),
        )
        mock_retriever.retrieve.return_value = mock_result

        tool = create_documentation_search_tool(
            retriever=mock_retriever,
            domain="test.com",
        )

        result = await tool.execute({"query": "test"})

        assert len(result) == 1
        assert result[0]["title"] is None
        assert result[0]["url"] is None
        assert result[0]["product"] is None
