from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.auth.models import AuthState
from src.credits.types import CreditCheckResult
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


def _apply_base_patches(stack: ExitStack, mock_credit_client: AsyncMock) -> None:
    stack.enter_context(patch("src.routes.chat.fetch_auth_state", return_value=AuthState(authenticated=False)))
    stack.enter_context(patch("src.routes.chat.fetch_docs_metadata", return_value=MOCK_METADATA))
    stack.enter_context(patch("src.routes.chat.validate_docs_metadata"))
    stack.enter_context(patch("src.routes.chat.check_ask_ai_status", return_value=MOCK_ASK_AI))
    stack.enter_context(patch("src.routes.chat.get_credit_client", return_value=mock_credit_client))
    stack.enter_context(patch("src.routes.chat.is_credit_gated", return_value=True))


class TestPerMessageCreditCheck:
    def test_single_message_blocked_when_credits_exhausted(self, client: TestClient) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
        }

        mock_client = AsyncMock()
        mock_client.check_credits.return_value = CreditCheckResult(allowed=False, used=1000, limit=1000)

        with ExitStack() as stack:
            _apply_base_patches(stack, mock_client)
            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

        assert response.status_code == 429
        assert response.json() == {"detail": "AI credit limit reached"}
        mock_client.check_credits.assert_awaited_once_with("test.buildwithfern.com", "org_123")

    def test_followup_also_blocked_when_credits_exhausted(self, client: TestClient) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
                {"role": "assistant", "parts": [{"type": "text", "text": "The API allows..."}]},
                {"role": "user", "parts": [{"type": "text", "text": "Tell me more"}]},
            ],
            "conversationId": "conv_existing_123",
        }

        mock_client = AsyncMock()
        mock_client.check_credits.return_value = CreditCheckResult(allowed=False, used=1000, limit=1000)

        with ExitStack() as stack:
            _apply_base_patches(stack, mock_client)
            response = client.post(
                "/chat",
                json=request_data,
                headers={"x-fern-host": "test.buildwithfern.com"},
            )

        assert response.status_code == 429
        assert response.json() == {"detail": "AI credit limit reached"}
        mock_client.check_credits.assert_awaited_once_with("test.buildwithfern.com", "org_123")

    def test_credits_available_allows_request(self, client: TestClient) -> None:
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
        }

        mock_client = AsyncMock()
        mock_client.check_credits.return_value = CreditCheckResult(allowed=True, used=50, limit=1000)

        with ExitStack() as stack:
            _apply_base_patches(stack, mock_client)
            try:
                client.post(
                    "/chat",
                    json=request_data,
                    headers={"x-fern-host": "test.buildwithfern.com"},
                )
            except Exception:
                pass

        mock_client.check_credits.assert_awaited_once_with("test.buildwithfern.com", "org_123")
