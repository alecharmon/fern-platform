from unittest.mock import patch

from fastapi.testclient import TestClient

from tests.conftest import TEST_FERN_TOKEN
from tests.factories import (
    PostChatCompletionRequestFactory,
    create_test_domain,
)


class TestChat:
    def test_post_chat_completion_success_claude(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = PostChatCompletionRequestFactory.build(model="claude-4-sonnet-20250514")

        mock_turns = [{"text": "Hello, I can help you with that!"}]
        mock_citations = ["doc1", "doc2"]

        with patch("src.fai.routes.chat.v1_retrieve") as mock_retrieve, patch(
            "src.fai.routes.chat.get_anthropic_response"
        ) as mock_anthropic:
            mock_retrieve.return_value = [
                type("Row", (), {"document": "test doc 1"})(),
                type("Row", (), {"document": "test doc 2"})(),
            ]
            mock_anthropic.return_value = (mock_turns, mock_citations)

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

        mock_turns = [{"text": "Hello from Cohere!"}]
        mock_citations = ["doc3"]

        with patch("src.fai.routes.chat.v1_retrieve") as mock_retrieve, patch(
            "src.fai.routes.chat.get_cohere_response"
        ) as mock_cohere:
            mock_retrieve.return_value = [type("Row", (), {"document": "test doc"})()]
            mock_cohere.return_value = (mock_turns, mock_citations)

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

        # Bypass Pydantic validation by manually creating invalid request
        invalid_request_data = {
            "model": "unsupported-model",
            "system_prompt": "You are a helpful assistant.",
            "messages": [{"role": "user", "content": "Test message"}],
        }

        response = test_client.post(
            f"/chat/{domain}", json=invalid_request_data, headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 422  # Pydantic validation error
        data = response.json()
        assert "detail" in data

    def test_post_chat_completion_no_messages(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = PostChatCompletionRequestFactory.build(messages=[])

        mock_turns = [{"text": "No context response"}]
        mock_citations: list[str] = []

        with patch("src.fai.routes.chat.v1_retrieve") as mock_retrieve, patch(
            "src.fai.routes.chat.get_anthropic_response"
        ) as mock_anthropic:
            mock_retrieve.return_value = []  # No retrieval results for empty messages
            mock_anthropic.return_value = (mock_turns, mock_citations)

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

        with patch("src.fai.routes.chat.v1_retrieve") as mock_retrieve:
            mock_retrieve.side_effect = Exception("Retrieve error")

            response = test_client.post(
                f"/chat/{domain}",
                json=request_body.model_dump(),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert data["detail"] == "Retrieve error"
