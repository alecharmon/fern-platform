import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient


def test_health_check_sync(test_client: TestClient) -> None:
    """Test that the health check endpoint returns 200 using sync client."""
    response = test_client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert "status" in data, "status should be in the response"
    assert data["status"] == "hello fernie!", "status should be 'hello fernie!'"


@pytest.mark.asyncio
async def test_health_check_async(async_test_client: AsyncClient) -> None:
    """Test that the health check endpoint returns 200 using async client."""
    response = await async_test_client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert "status" in data, "status should be in the response"
    assert data["status"] == "hello fernie!", "status should be 'hello fernie!'"
