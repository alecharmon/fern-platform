from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.llm.models import (
    StreamEvent,
    StreamEventType,
)
from src.queries.models import QueryData
from src.retrieval.interface import (
    RetrievalQuery,
    RetrievalResult,
    RetrievedDocument,
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_retrieval_result() -> RetrievalResult:
    query = RetrievalQuery(
        query="What is the API?",
        domain="test.buildwithfern.com",
        top_k=5,
    )
    return RetrievalResult(
        documents=[
            RetrievedDocument(
                content="Test document content",
                score=0.95,
                metadata={"title": "Test Doc", "url": "https://example.com/doc"},
            ),
        ],
        query=query,
        retrieval_time_ms=50.0,
    )


@pytest.fixture
def mock_llm_stream() -> Any:
    async def stream(messages: Any, tools: Any | None = None) -> AsyncGenerator[StreamEvent, None]:
        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=" world")
        yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 100, "output_tokens": 50})
        yield StreamEvent(type=StreamEventType.DONE, data="")

    return stream


class TestChatQuerySaving:
    @pytest.mark.asyncio
    async def test_saves_user_query_when_skip_save_query_is_false(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Any,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
            "queryId": "test-query-id",
            "conversationId": "test-conversation-id",
            "source": "CHAT",
            "skipSaveQuery": False,
        }

        with (
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata"),
            patch("src.routes.chat.is_ask_ai_enabled", return_value=True),
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
            patch("src.routes.chat.save_query") as mock_save_query,
        ):
            mock_fetch_metadata.return_value = {"domain": "test.com"}

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_provider.provider_name = "anthropic"
            mock_get_provider.return_value = mock_provider

            mock_fai_client = MagicMock()
            mock_get_fai_client.return_value = mock_fai_client

            mock_save_query.return_value = AsyncMock(return_value="test-query-id")

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200

            assert mock_save_query.call_count >= 1

            user_query_call = mock_save_query.call_args_list[0]
            user_query_data: QueryData = user_query_call[0][1]
            assert user_query_data.query_id == "test-query-id"
            assert user_query_data.conversation_id == "test-conversation-id"
            assert user_query_data.domain == "test.buildwithfern.com"
            assert user_query_data.text == "What is the API?"
            assert user_query_data.role == "USER"
            assert user_query_data.source == "CHAT"

    @pytest.mark.asyncio
    async def test_saves_assistant_query_after_streaming(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Any,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
            "queryId": "test-query-id",
            "conversationId": "test-conversation-id",
            "source": "CHAT",
            "skipSaveQuery": False,
        }

        with (
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata"),
            patch("src.routes.chat.is_ask_ai_enabled", return_value=True),
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
            patch("src.routes.chat.save_query") as mock_save_query,
        ):
            mock_fetch_metadata.return_value = {"domain": "test.com"}

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_provider.provider_name = "anthropic"
            mock_get_provider.return_value = mock_provider

            mock_fai_client = MagicMock()
            mock_get_fai_client.return_value = mock_fai_client

            mock_save_query.return_value = AsyncMock(return_value="query-id")

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200

            assert mock_save_query.call_count == 2

            assistant_query_call = mock_save_query.call_args_list[1]
            assistant_query_data: QueryData = assistant_query_call[0][1]
            assert assistant_query_data.conversation_id == "test-conversation-id"
            assert assistant_query_data.domain == "test.buildwithfern.com"
            assert assistant_query_data.text == "Hello world"
            assert assistant_query_data.role == "ASSISTANT"
            assert assistant_query_data.source == "CHAT"
            assert assistant_query_data.time_to_first_token is not None

    @pytest.mark.asyncio
    async def test_does_not_save_queries_when_skip_save_query_is_true(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Any,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
            "skipSaveQuery": True,
        }

        with (
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata"),
            patch("src.routes.chat.is_ask_ai_enabled", return_value=True),
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.get_fai_client"),
            patch("src.routes.chat.save_query") as mock_save_query,
        ):
            mock_fetch_metadata.return_value = {"domain": "test.com"}

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_provider.provider_name = "anthropic"
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200
            mock_save_query.assert_not_called()

    @pytest.mark.asyncio
    async def test_generates_conversation_id_when_not_provided(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Any,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
            "skipSaveQuery": False,
        }

        with (
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata"),
            patch("src.routes.chat.is_ask_ai_enabled", return_value=True),
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
            patch("src.routes.chat.save_query") as mock_save_query,
        ):
            mock_fetch_metadata.return_value = {"domain": "test.com"}

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_provider.provider_name = "anthropic"
            mock_get_provider.return_value = mock_provider

            mock_fai_client = MagicMock()
            mock_get_fai_client.return_value = mock_fai_client

            mock_save_query.return_value = AsyncMock(return_value="query-id")

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200

            user_query_call = mock_save_query.call_args_list[0]
            user_query_data: QueryData = user_query_call[0][1]
            assert user_query_data.conversation_id is not None
            assert len(user_query_data.conversation_id) == 36

    @pytest.mark.asyncio
    async def test_uses_default_source_when_not_provided(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Any,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
            "skipSaveQuery": False,
        }

        with (
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata"),
            patch("src.routes.chat.is_ask_ai_enabled", return_value=True),
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
            patch("src.routes.chat.save_query") as mock_save_query,
        ):
            mock_fetch_metadata.return_value = {"domain": "test.com"}

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_provider.provider_name = "anthropic"
            mock_get_provider.return_value = mock_provider

            mock_fai_client = MagicMock()
            mock_get_fai_client.return_value = mock_fai_client

            mock_save_query.return_value = AsyncMock(return_value="query-id")

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200

            user_query_call = mock_save_query.call_args_list[0]
            user_query_data: QueryData = user_query_call[0][1]
            assert user_query_data.source == "CHAT"

    @pytest.mark.asyncio
    async def test_query_saving_failure_does_not_fail_request(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Any,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
            "skipSaveQuery": False,
        }

        with (
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata"),
            patch("src.routes.chat.is_ask_ai_enabled", return_value=True),
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
            patch("src.routes.chat.save_query") as mock_save_query,
        ):
            mock_fetch_metadata.return_value = {"domain": "test.com"}

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_provider.provider_name = "anthropic"
            mock_get_provider.return_value = mock_provider

            mock_fai_client = MagicMock()
            mock_get_fai_client.return_value = mock_fai_client

            mock_save_query.return_value = None

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200
            assert "Hello" in response.text
            assert "world" in response.text

    @pytest.mark.asyncio
    async def test_user_and_assistant_queries_share_same_conversation_id(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Any,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
            "conversationId": "shared-conversation-id",
            "skipSaveQuery": False,
        }

        with (
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata"),
            patch("src.routes.chat.is_ask_ai_enabled", return_value=True),
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
            patch("src.routes.chat.save_query") as mock_save_query,
        ):
            mock_fetch_metadata.return_value = {"domain": "test.com"}

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_provider.provider_name = "anthropic"
            mock_get_provider.return_value = mock_provider

            mock_fai_client = MagicMock()
            mock_get_fai_client.return_value = mock_fai_client

            mock_save_query.return_value = AsyncMock(return_value="query-id")

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200
            assert mock_save_query.call_count == 2

            user_query_data: QueryData = mock_save_query.call_args_list[0][0][1]
            assistant_query_data: QueryData = mock_save_query.call_args_list[1][0][1]

            assert user_query_data.conversation_id == "shared-conversation-id"
            assert assistant_query_data.conversation_id == "shared-conversation-id"
