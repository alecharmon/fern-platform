from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from fai.credits.types import CreditCheckResult
from tests.conftest import TEST_FERN_TOKEN
from tests.factories import create_test_domain


def _create_mock_retrieved_doc(content: str, url: str | None = None) -> MagicMock:
    doc = MagicMock()
    doc.content = content
    doc.score = 0.9
    doc.document_id = f"doc_{hash(content)}"
    doc.metadata = {"url": url, "title": "Test Doc"} if url else {}
    return doc


def _create_mock_retrieval_result(documents: list[MagicMock]) -> MagicMock:
    result = MagicMock()
    result.documents = documents
    return result


def _create_mock_llm_response(content: str) -> MagicMock:
    response = MagicMock()
    response.content = content
    response.model_id = "claude-4-sonnet"
    response.metrics.input_tokens = 100
    response.metrics.output_tokens = 50
    response.metrics.total_time_ms = 1500.0
    return response


class TestPerMessageCreditCheck:
    def test_new_conversation_blocked_when_credits_exhausted(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_data = {
            "model": "claude-4-sonnet",
            "messages": [{"role": "user", "content": "What is the API?"}],
        }

        mock_credit_client = AsyncMock()
        mock_credit_client._resolve_org_id.return_value = "org_gated"
        mock_credit_client.check_credits.return_value = CreditCheckResult(allowed=False, used=1000, limit=1000)

        mock_retriever = MagicMock()
        mock_retriever.retrieve = AsyncMock(
            return_value=_create_mock_retrieval_result([_create_mock_retrieved_doc("doc", "https://example.com")])
        )

        mock_provider = MagicMock()
        mock_provider.generate = AsyncMock(return_value=_create_mock_llm_response("response"))

        with (
            patch("fai.routes.chat.get_retriever", return_value=mock_retriever),
            patch("fai.routes.chat.get_llm_provider", return_value=mock_provider),
            patch("fai.routes.chat.get_credit_client", return_value=mock_credit_client),
            patch("fai.routes.chat.is_credit_gated", return_value=True),
        ):
            response = test_client.post(
                f"/chat/{domain}",
                json=request_data,
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 429
        assert response.json() == {"detail": "AI credit limit reached"}
        mock_credit_client.check_credits.assert_awaited_once()

    def test_followup_also_blocked_when_credits_exhausted(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_data = {
            "model": "claude-4-sonnet",
            "messages": [
                {"role": "user", "content": "What is the API?"},
                {"role": "assistant", "content": "The API allows..."},
                {"role": "user", "content": "Tell me more"},
            ],
        }

        mock_credit_client = AsyncMock()
        mock_credit_client._resolve_org_id.return_value = "org_gated"
        mock_credit_client.check_credits.return_value = CreditCheckResult(allowed=False, used=1000, limit=1000)

        mock_retriever = MagicMock()
        mock_retriever.retrieve = AsyncMock(
            return_value=_create_mock_retrieval_result([_create_mock_retrieved_doc("doc", "https://example.com")])
        )

        mock_provider = MagicMock()
        mock_provider.generate = AsyncMock(return_value=_create_mock_llm_response("response"))

        with (
            patch("fai.routes.chat.get_retriever", return_value=mock_retriever),
            patch("fai.routes.chat.get_llm_provider", return_value=mock_provider),
            patch("fai.routes.chat.get_credit_client", return_value=mock_credit_client),
            patch("fai.routes.chat.is_credit_gated", return_value=True),
        ):
            response = test_client.post(
                f"/chat/{domain}",
                json=request_data,
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 429
        assert response.json() == {"detail": "AI credit limit reached"}
        mock_credit_client.check_credits.assert_awaited_once()

    def test_credits_available_allows_new_conversation(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_data = {
            "model": "claude-4-sonnet",
            "messages": [{"role": "user", "content": "What is the API?"}],
        }

        mock_credit_client = AsyncMock()
        mock_credit_client._resolve_org_id.return_value = "org_gated"
        mock_credit_client.check_credits.return_value = CreditCheckResult(allowed=True, used=50, limit=1000)

        mock_docs = [_create_mock_retrieved_doc("doc", "https://example.com")]
        mock_retriever = MagicMock()
        mock_retriever.retrieve = AsyncMock(return_value=_create_mock_retrieval_result(mock_docs))

        mock_provider = MagicMock()
        mock_provider.generate = AsyncMock(return_value=_create_mock_llm_response("Here is the API info"))

        with (
            patch("fai.routes.chat.get_retriever", return_value=mock_retriever),
            patch("fai.routes.chat.get_llm_provider", return_value=mock_provider),
            patch("fai.routes.chat.get_credit_client", return_value=mock_credit_client),
            patch("fai.routes.chat.is_credit_gated", return_value=True),
        ):
            response = test_client.post(
                f"/chat/{domain}",
                json=request_data,
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        mock_credit_client.check_credits.assert_awaited_once()
