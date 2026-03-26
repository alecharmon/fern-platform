from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fai_ai_core.llm.models import StreamEvent, StreamEventType
from fai_ai_core.retrieval.interface import RetrievalQuery, RetrievalResult, RetrievalStrategy, RetrievedDocument
from fastapi.testclient import TestClient

from src.app import app
from src.auth.models import AuthState
from src.metadata.fetcher import DocsMetadata
from src.settings.ask_ai import AskAIStatus


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


MOCK_METADATA = DocsMetadata(
    url="test.buildwithfern.com",
    org="org_123",
    is_preview=False,
    enable_algolia_on_preview=False,
)

MOCK_ASK_AI = AskAIStatus(enabled=True, decompose_queries=False, is_initially_indexing=False)


def _create_mock_retrieval_result() -> RetrievalResult:
    doc = MagicMock(spec=RetrievedDocument)
    doc.content = "Some documentation content"
    doc.score = 0.9
    doc.document_id = "doc_1"
    doc.metadata = {"url": "https://example.com/docs", "title": "Test Doc"}
    query = RetrievalQuery(
        query="test",
        domain="test.buildwithfern.com",
        top_k=6,
        strategy=RetrievalStrategy.SEMANTIC,
    )
    return RetrievalResult(documents=[doc], query=query, retrieval_time_ms=50.0)


async def _mock_generate_stream(messages, **kwargs):
    yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Here is the answer")
    yield StreamEvent(type=StreamEventType.USAGE, data={"input_tokens": 100, "output_tokens": 50})
    yield StreamEvent(type=StreamEventType.FINISH, data="")


def _apply_full_pipeline_patches(stack: ExitStack, mock_credit_client: AsyncMock) -> None:
    mock_retriever = MagicMock()
    mock_retriever.retrieve = AsyncMock(return_value=_create_mock_retrieval_result())

    mock_provider = MagicMock()
    mock_provider.generate_stream = _mock_generate_stream
    mock_provider.provider_name = "mock"

    stack.enter_context(patch("src.routes.chat.fetch_auth_state", return_value=AuthState(authenticated=False)))
    stack.enter_context(patch("src.routes.chat.fetch_docs_metadata", return_value=MOCK_METADATA))
    stack.enter_context(patch("src.routes.chat.validate_docs_metadata"))
    stack.enter_context(patch("src.routes.chat.check_ask_ai_status", return_value=MOCK_ASK_AI))
    stack.enter_context(patch("src.routes.chat.get_retriever", return_value=mock_retriever))
    stack.enter_context(patch("src.routes.chat.get_llm_provider", return_value=mock_provider))
    stack.enter_context(patch("src.routes.chat.get_credit_client", return_value=mock_credit_client))
    stack.enter_context(patch("src.routes.chat.is_credit_gated", return_value=True))
    stack.enter_context(patch("src.routes.chat.save_query", return_value=None))
    stack.enter_context(patch("src.routes.chat.get_fai_client", return_value=MagicMock()))


class TestCreditLoggingWithoutBlocking:
    def test_request_not_blocked_when_credits_exhausted(self, client: TestClient) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
        }

        mock_client = AsyncMock()

        with ExitStack() as stack:
            _apply_full_pipeline_patches(stack, mock_client)
            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

        assert response.status_code == 200
        mock_client.check_credits.assert_not_awaited()

    def test_no_credit_check_called_before_request(self, client: TestClient) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
                {"role": "assistant", "parts": [{"type": "text", "text": "The API allows..."}]},
                {"role": "user", "parts": [{"type": "text", "text": "Tell me more"}]},
            ],
            "conversationId": "conv_existing_123",
        }

        mock_client = AsyncMock()

        with ExitStack() as stack:
            _apply_full_pipeline_patches(stack, mock_client)
            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

        assert response.status_code == 200
        mock_client.check_credits.assert_not_awaited()
