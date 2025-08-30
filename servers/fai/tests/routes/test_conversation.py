from fastapi.testclient import TestClient

from tests.factories import (
    create_test_domain,
    create_test_id,
)


class TestGetConversation:
    def test_get_conversation_success(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        conversation_id = create_test_id()

        response = test_client.get(f"/conversation/{domain}/{conversation_id}")

        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert "conversation" in data
            assert "conversation_id" in data["conversation"]
            assert "turns" in data["conversation"]
            assert "created_at" in data["conversation"]

    def test_get_conversation_not_found(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        nonexistent_conversation_id = create_test_id()

        response = test_client.get(f"/conversation/{domain}/{nonexistent_conversation_id}")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Conversation not found"
