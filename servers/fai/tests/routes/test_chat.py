from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

from fastapi.testclient import TestClient

from tests.conftest import TEST_FERN_TOKEN
from tests.factories import (
    PostChatCompletionRequestFactory,
    create_test_domain,
)


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


def _create_mock_llm_response(content: str, model_id: str = "claude-4-sonnet") -> MagicMock:
    response = MagicMock()
    response.content = content
    response.model_id = model_id
    response.metrics.input_tokens = 100
    response.metrics.output_tokens = 50
    response.metrics.total_time_ms = 1500.0
    return response


class TestChat:
    def test_post_chat_completion_success_claude(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = PostChatCompletionRequestFactory.build(model="claude-4-sonnet")

        mock_docs = [
            _create_mock_retrieved_doc("test doc 1", "https://example.com/1"),
            _create_mock_retrieved_doc("test doc 2", "https://example.com/2"),
        ]

        mock_response = _create_mock_llm_response("Hello, I can help you with that!")

        mock_retriever = MagicMock()
        mock_retriever.retrieve = AsyncMock(return_value=_create_mock_retrieval_result(mock_docs))

        mock_provider = MagicMock()
        mock_provider.generate = AsyncMock(return_value=mock_response)

        with (
            patch("fai.routes.chat.get_retriever", return_value=mock_retriever),
            patch("fai.routes.chat.get_llm_provider", return_value=mock_provider),
        ):
            response = test_client.post(
                f"/chat/{domain}",
                json=request_body.model_dump(),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "turns" in data
            assert "citations" in data
            assert len(data["turns"]) == 1
            assert data["turns"][0]["role"] == "assistant"
            assert data["turns"][0]["content"] == "Hello, I can help you with that!"
            assert len(data["citations"]) == 2

    def test_post_chat_completion_success_cohere(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = PostChatCompletionRequestFactory.build(model="command-a-03-2025")

        mock_docs = [_create_mock_retrieved_doc("test doc", "https://example.com/doc")]

        mock_response = _create_mock_llm_response("Hello from Cohere!", model_id="command-a-03-2025")

        mock_retriever = MagicMock()
        mock_retriever.retrieve = AsyncMock(return_value=_create_mock_retrieval_result(mock_docs))

        mock_provider = MagicMock()
        mock_provider.generate = AsyncMock(return_value=mock_response)

        with (
            patch("fai.routes.chat.get_retriever", return_value=mock_retriever),
            patch("fai.routes.chat.get_llm_provider", return_value=mock_provider),
        ):
            response = test_client.post(
                f"/chat/{domain}",
                json=request_body.model_dump(),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "turns" in data
            assert "citations" in data
            assert len(data["turns"]) == 1
            assert data["turns"][0]["content"] == "Hello from Cohere!"

    def test_post_chat_completion_unsupported_model(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        invalid_request_data = {
            "model": "unsupported-model",
            "system_prompt": "You are a helpful assistant.",
            "messages": [{"role": "user", "content": "Test message"}],
        }

        response = test_client.post(
            f"/chat/{domain}",
            json=invalid_request_data,
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_post_chat_completion_no_messages(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = PostChatCompletionRequestFactory.build(messages=[])

        mock_response = _create_mock_llm_response("No context response")

        mock_retriever = MagicMock()
        mock_retriever.retrieve = AsyncMock(return_value=_create_mock_retrieval_result([]))

        mock_provider = MagicMock()
        mock_provider.generate = AsyncMock(return_value=mock_response)

        with (
            patch("fai.routes.chat.get_retriever", return_value=mock_retriever),
            patch("fai.routes.chat.get_llm_provider", return_value=mock_provider),
        ):
            response = test_client.post(
                f"/chat/{domain}",
                json=request_body.model_dump(),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "turns" in data
            assert "citations" in data

    def test_post_chat_completion_failure(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = PostChatCompletionRequestFactory.build()

        mock_retriever = MagicMock()
        mock_retriever.retrieve = AsyncMock(side_effect=Exception("Retrieve error"))

        with patch("fai.routes.chat.get_retriever", return_value=mock_retriever):
            response = test_client.post(
                f"/chat/{domain}",
                json=request_body.model_dump(),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert data["detail"] == "Retrieve error"
