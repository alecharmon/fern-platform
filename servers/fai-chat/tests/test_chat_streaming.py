from collections.abc import (
    AsyncGenerator,
    Callable,
)
from typing import Any
from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest
from fai_ai_core.llm.models import (
    StreamEvent,
    StreamEventType,
)
from fai_ai_core.retrieval.interface import (
    RetrievalQuery,
    RetrievalResult,
    RetrievedDocument,
)
from fastapi.testclient import TestClient

from src.app import app
from src.auth.models import AuthState
from src.exceptions import MetadataValidationError
from src.metadata.fetcher import DocsMetadata
from src.settings.ask_ai import AskAIStatus


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
                metadata={"title": "Test Doc 1", "url": "https://example.com/doc1"},
            ),
            RetrievedDocument(
                content="Another document",
                score=0.90,
                metadata={"title": "Test Doc 2", "url": "https://example.com/doc2"},
            ),
        ],
        query=query,
        retrieval_time_ms=50.0,
    )


@pytest.fixture
def mock_llm_stream() -> Callable[[Any], AsyncGenerator[StreamEvent, None]]:
    async def stream(messages: Any, tools: Any | None = None) -> AsyncGenerator[StreamEvent, None]:
        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data=" world")
        yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 100, "output_tokens": 50})
        yield StreamEvent(type=StreamEventType.DONE, data="")

    return stream


class TestChatStreamingIntegration:
    @pytest.mark.asyncio
    async def test_complete_chat_flow(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Callable[[Any], AsyncGenerator[StreamEvent, None]],
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
        }

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="test",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        with (
            patch("src.routes.chat.fetch_auth_state") as mock_fetch_auth,
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata") as mock_validate_metadata,
            patch("src.routes.chat.check_ask_ai_status") as mock_ask_ai,
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.save_query") as mock_save_query,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
        ):
            mock_fetch_auth.return_value = AuthState(authenticated=False)
            mock_fetch_metadata.return_value = mock_metadata
            mock_validate_metadata.return_value = None
            mock_ask_ai.return_value = AskAIStatus(enabled=True, decompose_queries=False, is_initially_indexing=False)
            mock_save_query.return_value = "query-id"
            mock_get_fai_client.return_value = MagicMock()

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
            assert response.headers["cache-control"] == "no-cache"
            assert response.headers["connection"] == "keep-alive"

            content = response.text
            lines = content.strip().split("\n\n")

            assert len(lines) >= 10

            assert '"type": "data-sources"' in lines[0]
            assert '"title": "Test Doc 1"' in lines[0]
            assert '"url": "https://example.com/doc1"' in lines[0]
            assert '"title": "Test Doc 2"' in lines[0]
            assert '"url": "https://example.com/doc2"' in lines[0]

            assert '"type": "data-assistant-query-id"' in lines[1]

            assert '"type": "start"' in lines[2]
            assert '"messageId"' in lines[2]

            assert '"type":"start-step"' in lines[3]

            assert '"type": "text-start"' in lines[4]
            assert '"id": "0"' in lines[4]

            text_deltas = [line for line in lines if '"type": "text-delta"' in line]
            assert len(text_deltas) == 2
            assert '"delta": "Hello"' in text_deltas[0]
            assert '"delta": " world"' in text_deltas[1]

            assert '"type": "text-end"' in content
            assert '"type":"finish-step"' in content
            assert '"type":"finish"' in content
            assert "data: [DONE]" in content

    @pytest.mark.asyncio
    async def test_source_extraction_from_documents(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Callable[[Any], AsyncGenerator[StreamEvent, None]],
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Test query"}]},
            ],
        }

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="test",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        with (
            patch("src.routes.chat.fetch_auth_state") as mock_fetch_auth,
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata") as mock_validate_metadata,
            patch("src.routes.chat.check_ask_ai_status") as mock_ask_ai,
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.save_query") as mock_save_query,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
        ):
            mock_fetch_auth.return_value = AuthState(authenticated=False)
            mock_fetch_metadata.return_value = mock_metadata
            mock_validate_metadata.return_value = None
            mock_ask_ai.return_value = AskAIStatus(enabled=True, decompose_queries=False, is_initially_indexing=False)
            mock_save_query.return_value = "query-id"
            mock_get_fai_client.return_value = MagicMock()

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            content = response.text
            sources_line = content.split("\n\n")[0]

            assert '"type": "data-sources"' in sources_line
            assert '"title": "Test Doc 1"' in sources_line
            assert '"url": "https://example.com/doc1"' in sources_line
            assert '"title": "Test Doc 2"' in sources_line
            assert '"url": "https://example.com/doc2"' in sources_line

    @pytest.mark.asyncio
    async def test_error_handling_metadata_validation_fails(
        self,
        client: TestClient,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Test query"}]},
            ],
        }

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="test",
            is_preview=True,
            enable_algolia_on_preview=False,
        )

        with (
            patch("src.routes.chat.fetch_auth_state") as mock_fetch_auth,
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata") as mock_validate_metadata,
        ):
            mock_fetch_auth.return_value = AuthState(authenticated=False)
            mock_fetch_metadata.return_value = mock_metadata
            mock_validate_metadata.side_effect = MetadataValidationError("Invalid metadata")

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 404
            assert "Invalid metadata" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_error_handling_ask_ai_disabled(
        self,
        client: TestClient,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Test query"}]},
            ],
        }

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="test",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        with (
            patch("src.routes.chat.fetch_auth_state") as mock_fetch_auth,
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata") as mock_validate_metadata,
            patch("src.routes.chat.check_ask_ai_status") as mock_ask_ai,
        ):
            mock_fetch_auth.return_value = AuthState(authenticated=False)
            mock_fetch_metadata.return_value = mock_metadata
            mock_validate_metadata.return_value = None
            mock_ask_ai.return_value = AskAIStatus(enabled=False, decompose_queries=False, is_initially_indexing=False)

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 404
            assert "Ask AI is not enabled" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_error_handling_retrieval_fails(
        self,
        client: TestClient,
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Test query"}]},
            ],
        }

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="test",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        with (
            patch("src.routes.chat.fetch_auth_state") as mock_fetch_auth,
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata") as mock_validate_metadata,
            patch("src.routes.chat.check_ask_ai_status") as mock_ask_ai,
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
        ):
            mock_fetch_auth.return_value = AuthState(authenticated=False)
            mock_fetch_metadata.return_value = mock_metadata
            mock_validate_metadata.return_value = None
            mock_ask_ai.return_value = AskAIStatus(enabled=True, decompose_queries=False, is_initially_indexing=False)

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(side_effect=Exception("Retrieval failed"))
            mock_get_retriever.return_value = mock_retriever

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 500
            assert "Failed to retrieve documents" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_empty_sources_handling(
        self,
        client: TestClient,
        mock_llm_stream: Callable[[Any], AsyncGenerator[StreamEvent, None]],
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Test query"}]},
            ],
        }

        query = RetrievalQuery(
            query="Test query",
            domain="test.buildwithfern.com",
            top_k=5,
        )
        empty_retrieval_result = RetrievalResult(
            documents=[],
            query=query,
            retrieval_time_ms=10.0,
        )

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="test",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        with (
            patch("src.routes.chat.fetch_auth_state") as mock_fetch_auth,
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata") as mock_validate_metadata,
            patch("src.routes.chat.check_ask_ai_status") as mock_ask_ai,
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.save_query") as mock_save_query,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
        ):
            mock_fetch_auth.return_value = AuthState(authenticated=False)
            mock_fetch_metadata.return_value = mock_metadata
            mock_validate_metadata.return_value = None
            mock_ask_ai.return_value = AskAIStatus(enabled=True, decompose_queries=False, is_initially_indexing=False)
            mock_save_query.return_value = "query-id"
            mock_get_fai_client.return_value = MagicMock()

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=empty_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            assert response.status_code == 200
            content = response.text
            sources_line = content.split("\n\n")[0]

            assert '"type": "data-sources"' in sources_line
            assert '"data": []' in sources_line

    @pytest.mark.asyncio
    async def test_protocol_sequence_matches_production(
        self,
        client: TestClient,
        mock_retrieval_result: RetrievalResult,
        mock_llm_stream: Callable[[Any], AsyncGenerator[StreamEvent, None]],
    ) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Test"}]},
            ],
        }

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="test",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        with (
            patch("src.routes.chat.fetch_auth_state") as mock_fetch_auth,
            patch("src.routes.chat.fetch_docs_metadata") as mock_fetch_metadata,
            patch("src.routes.chat.validate_docs_metadata") as mock_validate_metadata,
            patch("src.routes.chat.check_ask_ai_status") as mock_ask_ai,
            patch("src.routes.chat.get_retriever") as mock_get_retriever,
            patch("src.routes.chat.get_llm_provider") as mock_get_provider,
            patch("src.routes.chat.save_query") as mock_save_query,
            patch("src.routes.chat.get_fai_client") as mock_get_fai_client,
        ):
            mock_fetch_auth.return_value = AuthState(authenticated=False)
            mock_fetch_metadata.return_value = mock_metadata
            mock_validate_metadata.return_value = None
            mock_ask_ai.return_value = AskAIStatus(enabled=True, decompose_queries=False, is_initially_indexing=False)
            mock_save_query.return_value = "query-id"
            mock_get_fai_client.return_value = MagicMock()

            mock_retriever = MagicMock()
            mock_retriever.retrieve = AsyncMock(return_value=mock_retrieval_result)
            mock_get_retriever.return_value = mock_retriever

            mock_provider = MagicMock()
            mock_provider.generate_stream = mock_llm_stream
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

            content = response.text
            lines = content.strip().split("\n\n")

            event_types = []
            for line in lines:
                if '"type":' in line or '"type":' in line:
                    if "data-sources" in line:
                        event_types.append("data-sources")
                    elif "data-assistant-query-id" in line:
                        event_types.append("data-assistant-query-id")
                    elif "start" in line and "messageId" in line:
                        event_types.append("start")
                    elif "start-step" in line:
                        event_types.append("start-step")
                    elif "text-start" in line:
                        event_types.append("text-start")
                    elif "text-delta" in line:
                        event_types.append("text-delta")
                    elif "text-end" in line:
                        event_types.append("text-end")
                    elif "finish-step" in line:
                        event_types.append("finish-step")
                    elif "finish" in line and "finish-step" not in line:
                        event_types.append("finish")
                elif "[DONE]" in line:
                    event_types.append("DONE")

            expected_sequence = [
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

            assert event_types == expected_sequence
