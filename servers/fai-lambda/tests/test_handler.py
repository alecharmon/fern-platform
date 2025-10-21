"""Tests for the Lambda handler."""

import json
from unittest.mock import MagicMock

from src.handler import handler


def test_handler_returns_success():
    """Test that handler returns a successful response."""
    # Mock event
    event = {
        "path": "/",
        "httpMethod": "GET",
    }

    # Mock context
    context = MagicMock()
    context.request_id = "test-request-id"

    # Call handler
    response = handler(event, context)

    # Assert response
    assert response["statusCode"] == 200
    assert "Content-Type" in response["headers"]
    assert response["headers"]["Content-Type"] == "application/json"

    # Parse body
    body = json.loads(response["body"])
    assert body["message"] == "Hello World from fai-scribe!"
    assert body["requestId"] == "test-request-id"
    assert body["path"] == "/"
    assert body["method"] == "GET"
    assert "timestamp" in body
    assert "efs_mount_path" in body
    assert "efs_status" in body


def test_handler_with_different_path():
    """Test that handler correctly reports different paths."""
    # Mock event
    event = {
        "path": "/health",
        "httpMethod": "POST",
    }

    # Mock context
    context = MagicMock()
    context.request_id = "test-request-id-2"

    # Call handler
    response = handler(event, context)

    # Assert response
    assert response["statusCode"] == 200

    # Parse body
    body = json.loads(response["body"])
    assert body["path"] == "/health"
    assert body["method"] == "POST"
    assert body["requestId"] == "test-request-id-2"
