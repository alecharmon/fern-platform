from datetime import (
    UTC,
    datetime,
)
from unittest.mock import (
    AsyncMock,
    MagicMock,
)

import pytest

from src.queries.models import QueryData
from src.queries.writer import save_query


class TestSaveQuery:
    @pytest.mark.asyncio
    async def test_save_query_success(self) -> None:
        mock_client = MagicMock()
        mock_client.query.create_query = AsyncMock(return_value=None)

        query_data = QueryData(
            query_id="test-query-id",
            conversation_id="test-conversation-id",
            domain="test.docs.buildwithfern.com",
            text="What is Fern?",
            role="USER",
            source="chat",
            created_at=datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC),
        )

        result = await save_query(mock_client, query_data)

        assert result == "test-query-id"
        mock_client.query.create_query.assert_called_once()
        call_kwargs = mock_client.query.create_query.call_args[1]
        assert call_kwargs["domain"] == "test.docs.buildwithfern.com"
        assert call_kwargs["query_domain"] == "test.docs.buildwithfern.com"
        assert call_kwargs["query_id"] == "test-query-id"
        assert call_kwargs["conversation_id"] == "test-conversation-id"
        assert call_kwargs["text"] == "What is Fern?"
        assert call_kwargs["role"] == "USER"
        assert call_kwargs["source"] == "CHAT"
        assert call_kwargs["time_to_first_token"] is None

    @pytest.mark.asyncio
    async def test_save_query_with_ttft(self) -> None:
        mock_client = MagicMock()
        mock_client.query.create_query = AsyncMock(return_value=None)

        query_data = QueryData(
            query_id="assistant-query-id",
            conversation_id="test-conversation-id",
            domain="test.docs.buildwithfern.com",
            text="Fern is an API development platform.",
            role="ASSISTANT",
            source="CHAT",
            created_at=datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC),
            time_to_first_token=150.5,
        )

        result = await save_query(mock_client, query_data)

        assert result == "assistant-query-id"
        call_kwargs = mock_client.query.create_query.call_args[1]
        assert call_kwargs["role"] == "ASSISTANT"
        assert call_kwargs["time_to_first_token"] == 150.5

    @pytest.mark.asyncio
    async def test_save_query_uppercases_source(self) -> None:
        mock_client = MagicMock()
        mock_client.query.create_query = AsyncMock(return_value=None)

        query_data = QueryData(
            query_id="test-query-id",
            conversation_id="test-conversation-id",
            domain="test.docs.buildwithfern.com",
            text="Test query",
            role="USER",
            source="slack",
            created_at=datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC),
        )

        await save_query(mock_client, query_data)

        call_kwargs = mock_client.query.create_query.call_args[1]
        assert call_kwargs["source"] == "SLACK"

    @pytest.mark.asyncio
    async def test_save_query_failure_returns_none(self) -> None:
        mock_client = MagicMock()
        mock_client.query.create_query = AsyncMock(side_effect=Exception("API error"))

        query_data = QueryData(
            query_id="test-query-id",
            conversation_id="test-conversation-id",
            domain="test.docs.buildwithfern.com",
            text="Test query",
            role="USER",
            source="CHAT",
            created_at=datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC),
        )

        result = await save_query(mock_client, query_data)

        assert result is None

    @pytest.mark.asyncio
    async def test_save_query_passes_created_at(self) -> None:
        mock_client = MagicMock()
        mock_client.query.create_query = AsyncMock(return_value=None)

        query_data = QueryData(
            query_id="test-query-id",
            conversation_id="test-conversation-id",
            domain="test.docs.buildwithfern.com",
            text="Test query",
            role="USER",
            source="CHAT",
            created_at=datetime(2024, 1, 15, 10, 30, 45, tzinfo=UTC),
        )

        await save_query(mock_client, query_data)

        call_kwargs = mock_client.query.create_query.call_args[1]
        assert call_kwargs["created_at"] is not None


class TestQueryData:
    def test_query_data_with_all_fields(self) -> None:
        data = QueryData(
            query_id="q1",
            conversation_id="c1",
            domain="test.com",
            text="Hello",
            role="USER",
            source="CHAT",
            created_at=datetime(2024, 1, 15, tzinfo=UTC),
            time_to_first_token=100.0,
        )

        assert data.query_id == "q1"
        assert data.conversation_id == "c1"
        assert data.domain == "test.com"
        assert data.text == "Hello"
        assert data.role == "USER"
        assert data.source == "CHAT"
        assert data.time_to_first_token == 100.0

    def test_query_data_without_ttft(self) -> None:
        data = QueryData(
            query_id="q1",
            conversation_id="c1",
            domain="test.com",
            text="Hello",
            role="USER",
            source="CHAT",
            created_at=datetime(2024, 1, 15, tzinfo=UTC),
        )

        assert data.time_to_first_token is None
