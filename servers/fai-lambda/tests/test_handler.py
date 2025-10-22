"""Tests for the Lambda handler."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

from src.handler import handler


def test_handler_missing_repository():
    """Test that handler returns 400 when repository is missing."""
    event = {
        "body": json.dumps({"prompt": "Test prompt", "base_branch": "main"})
    }

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    assert "Content-Type" in response["headers"]


def test_handler_missing_prompt():
    """Test that handler returns 400 when prompt is missing."""
    event = {
        "body": json.dumps({"repository": "fern/docs", "base_branch": "main"})
    }

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    assert "Content-Type" in response["headers"]


def test_handler_missing_base_branch():
    """Test that handler returns 400 when base_branch is missing."""
    event = {
        "body": json.dumps({"repository": "fern/docs", "prompt": "Test prompt"})
    }

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    assert "Content-Type" in response["headers"]


def test_handler_invalid_repository_type():
    """Test that handler returns 400 when repository is not a string."""
    event = {
        "body": json.dumps({"repository": 123, "prompt": "Test prompt", "base_branch": "main"})
    }

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500


@patch("src.handler.run_agent_on_session_repo", new_callable=AsyncMock)
@patch("src.handler.os.path.exists")
def test_handler_success(mock_exists, mock_run_agent):
    """Test that handler returns success with valid input."""
    mock_exists.return_value = True
    mock_run_agent.return_value = {"session_repo_path": "/mnt/efs/repos/sessions/test/fern/docs", "status": "success"}

    event = {
        "body": json.dumps({
            "repository": "fern/docs",
            "prompt": "Update documentation",
            "base_branch": "main"
        })
    }

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


@patch("src.handler.os.path.exists")
def test_handler_efs_not_mounted(mock_exists):
    """Test that handler returns 500 when EFS is not mounted."""
    mock_exists.return_value = False

    event = {
        "body": json.dumps({
            "repository": "fern/docs",
            "prompt": "Update documentation",
            "base_branch": "main"
        })
    }

    context = MagicMock()
    context.aws_request_id = "test-request-id"

    response = handler(event, context)

    assert response["statusCode"] == 500
    body = json.loads(response["body"])
    assert "EFS not mounted" in body["error"]
