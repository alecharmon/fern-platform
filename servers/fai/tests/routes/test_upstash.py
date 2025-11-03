from unittest.mock import (
    AsyncMock,
    patch,
)

from fastapi.testclient import TestClient

from fai.models.api.qstash_failure_callback import QStashFailureCallback


def test_qstash_failure_callback_with_x_fern_host_string(test_client: TestClient) -> None:
    """Test that the QStash failure callback correctly formats message with X-Fern-Host as string."""
    callback_payload = {
        "dlqId": "dlq_123",
        "url": "https://fai.buildwithfern.com/webhooks/reindex",
        "status": 524,
        "sourceHeader": {
            "X-Fern-Host": "example.docs.buildwithfern.com",
        },
    }

    with patch("fai.routes.upstash.send_slack_message", new_callable=AsyncMock) as mock_slack:
        mock_slack.return_value = True

        response = test_client.post(
            "/upstash/qstash/failure-callback",
            json=callback_payload,
        )

        assert response.status_code == 200
        assert response.json() == {"success": True}

        # Verify Slack message was called with correct content
        mock_slack.assert_called_once()
        call_args = mock_slack.call_args
        assert call_args.kwargs["channel"] == "search-notifs"

        slack_message = call_args.kwargs["text"]
        assert "🚨 *QStash Reindexing Failure*" in slack_message
        assert "• *DLQ ID:* `dlq_123`" in slack_message
        assert "• *Status:* `524`" in slack_message
        assert "https://fai.buildwithfern.com/webhooks/reindex" in slack_message
        assert "• *Host:* `example.docs.buildwithfern.com`" in slack_message


def test_qstash_failure_callback_without_x_fern_host(test_client: TestClient) -> None:
    """Test that the QStash failure callback works without X-Fern-Host header."""
    callback_payload = {
        "dlqId": "dlq_456",
        "url": "https://fai.buildwithfern.com/webhooks/reindex",
        "status": 500,
        "sourceHeader": {
            "Content-Type": "application/json",
        },
    }

    with patch("fai.routes.upstash.send_slack_message", new_callable=AsyncMock) as mock_slack:
        mock_slack.return_value = True

        response = test_client.post(
            "/upstash/qstash/failure-callback",
            json=callback_payload,
        )

        assert response.status_code == 200

        # Verify Slack message doesn't include Host field when X-Fern-Host is not present
        call_args = mock_slack.call_args
        slack_message = call_args.kwargs["text"]
        assert "• *Host:*" not in slack_message
        assert "🚨 *QStash Reindexing Failure*" in slack_message
        assert "• *DLQ ID:* `dlq_456`" in slack_message
        assert "• *Status:* `500`" in slack_message


def test_qstash_failure_callback_pydantic_model() -> None:
    """Test that the Pydantic model correctly parses the QStash callback payload."""
    payload = {
        "dlqId": "test_id",
        "url": "https://example.com",
        "status": 524,
        "sourceHeader": {"X-Fern-Host": "test.com"},
    }

    model = QStashFailureCallback(**payload)
    assert model.dlq_id == "test_id"
    assert model.url == "https://example.com"
    assert model.status == 524
    assert model.source_header == {"X-Fern-Host": "test.com"}


def test_qstash_failure_callback_handles_errors(test_client: TestClient) -> None:
    """Test that the endpoint handles errors gracefully."""
    with patch("fai.routes.upstash.send_slack_message", new_callable=AsyncMock) as mock_slack:
        mock_slack.side_effect = Exception("Slack API error")

        response = test_client.post(
            "/upstash/qstash/failure-callback",
            json={
                "dlqId": "test",
                "url": "https://example.com",
                "status": 524,
                "sourceHeader": {},
            },
        )

        assert response.status_code == 500
        assert response.json()["success"] is False
        assert "Slack API error" in response.json()["error"]
