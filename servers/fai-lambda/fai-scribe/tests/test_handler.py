"""Tests for the Lambda handler."""

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from src.handler import handler


def test_handler_missing_repository() -> None:
    """Test that handler returns 400 when repository is missing."""
    event = {"body": json.dumps({"prompt": "Test prompt", "base_branch": "main"})}

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    assert "Content-Type" in response["headers"]


def test_handler_missing_prompt() -> None:
    """Test that handler returns 400 when prompt is missing."""
    event = {"body": json.dumps({"repository": "fern/docs", "base_branch": "main"})}

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    assert "Content-Type" in response["headers"]


def test_handler_missing_base_branch() -> None:
    """Test that handler returns 400 when base_branch is missing."""
    event = {"body": json.dumps({"repository": "fern/docs", "prompt": "Test prompt"})}

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    assert "Content-Type" in response["headers"]


def test_handler_invalid_repository_type() -> None:
    """Test that handler returns 400 when repository is not a string."""
    event = {"body": json.dumps({"repository": 123, "prompt": "Test prompt", "base_branch": "main"})}

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500


@patch("src.handler.run_agent_on_session_repo", new_callable=AsyncMock)
def test_handler_success(mock_run_agent: Any) -> None:
    """Test that handler returns success with valid input."""
    mock_run_agent.return_value = {"session_repo_path": "/tmp/test/fern/docs", "status": "success"}

    event = {"body": json.dumps({"repository": "fern/docs", "prompt": "Update documentation", "base_branch": "main"})}

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 200
    assert "Content-Type" in response["headers"]
    assert response["headers"]["Content-Type"] == "application/json"

    body = json.loads(response["body"])
    assert body["message"] == "Agent execution completed"
    assert body["requestId"] == "test-request-id"
    assert "timestamp" in body
    assert "result" in body
    assert body["result"]["status"] == "success"


@patch("src.handler.run_agent_on_session_repo", new_callable=AsyncMock)
def test_handler_with_error(mock_run_agent: Any) -> None:
    """Test that handler returns 500 when agent fails."""
    mock_run_agent.side_effect = RuntimeError("Agent execution failed")

    event = {"body": json.dumps({"repository": "fern/docs", "prompt": "Update documentation", "base_branch": "main"})}

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    body = json.loads(response["body"])
    assert "Agent execution failed" in body["error"]
