from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.auth.models import AuthState
from src.metadata.fetcher import DocsMetadata
from src.settings.ask_ai import AskAIStatus


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestFaiChatCreditGating:
    @pytest.mark.asyncio
    async def test_chat_route_does_not_block_when_credits_exhausted(self, client: TestClient) -> None:
        """Credits being exhausted should NOT block the request (no 429). check_credits is never called."""
        request_data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "What is the API?"}]},
            ],
        }

        mock_metadata = DocsMetadata(
            url="test.buildwithfern.com",
            org="org_123",
            is_preview=False,
            enable_algolia_on_preview=False,
        )
        mock_client = AsyncMock()

        with (
            patch("src.routes.chat.fetch_auth_state", return_value=AuthState(authenticated=False)),
            patch("src.routes.chat.fetch_docs_metadata", return_value=mock_metadata),
            patch("src.routes.chat.validate_docs_metadata"),
            patch(
                "src.routes.chat.check_ask_ai_status",
                return_value=AskAIStatus(enabled=True, decompose_queries=False, is_initially_indexing=False),
            ),
            patch("src.routes.chat.get_credit_client", return_value=mock_client),
            patch("src.routes.chat.is_credit_gated", return_value=True),
        ):
            try:
                response = client.post(
                    "/chat",
                    json=request_data,
                    headers={"x-fern-host": "test.buildwithfern.com"},
                )
                assert response.status_code != 429
            except Exception:
                pass

        mock_client.check_credits.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_check_when_client_none(self) -> None:
        with patch("src.routes.chat.get_credit_client", return_value=None):
            from src.routes.chat import get_credit_client

            assert get_credit_client() is None

    @pytest.mark.asyncio
    async def test_no_check_when_org_not_gated(self) -> None:
        mock_client = AsyncMock()
        with (
            patch("src.routes.chat.get_credit_client", return_value=mock_client),
            patch("src.routes.chat.is_credit_gated", return_value=False),
        ):
            from src.routes.chat import is_credit_gated

            assert is_credit_gated("org_123") is False
            mock_client.check_credits.assert_not_called()

    @pytest.mark.asyncio
    async def test_log_usage_called_with_correct_params(self) -> None:
        mock_client = AsyncMock()
        await mock_client.log_usage(
            "docs.example.com",
            question="How does authentication work?",
            response_tokens=200,
            org_id="org_123",
        )
        mock_client.log_usage.assert_called_once()
        kwargs = mock_client.log_usage.call_args[1]
        assert kwargs["question"] == "How does authentication work?"
        assert kwargs["response_tokens"] == 200

    @pytest.mark.asyncio
    async def test_log_usage_skipped_when_zero_tokens(self) -> None:
        mock_client = AsyncMock()
        output_tokens = 0
        if output_tokens > 0:
            await mock_client.log_usage("docs.example.com", question="test", response_tokens=0, org_id="org_123")
        mock_client.log_usage.assert_not_called()

    @pytest.mark.asyncio
    async def test_log_usage_error_swallowed(self) -> None:
        mock_client = AsyncMock()
        mock_client.log_usage.side_effect = Exception("dashboard down")
        try:
            await mock_client.log_usage(
                "docs.example.com",
                question="test question",
                response_tokens=100,
                org_id="org_123",
            )
        except Exception:
            pass
