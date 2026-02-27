from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

import fai.routes.health as health_module
from fai.utils.scribe.devin_client import ApiKeyStatus


@pytest.fixture(autouse=True)
def _clear_health_cache() -> None:
    """Reset the TTL cache before each test so results are not stale."""
    health_module._cached_devin_key_status = None
    health_module._cached_devin_key_ts = 0.0


def test_health_check_valid_key(test_client: TestClient) -> None:
    """Test that the health check returns 200 with 'valid' when the Devin API key is accepted."""
    with (
        patch("fai.routes.health.VARIABLES") as mock_variables,
        patch("fai.routes.health.check_devin_api_key", new_callable=AsyncMock, return_value=ApiKeyStatus.VALID),
    ):
        mock_variables.SCRIBE_DEVIN_API_KEY = "test-key"

        response = test_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "hello fernie!"
        assert data["checks"]["devin_api_key"] == "valid"


@pytest.mark.asyncio
async def test_health_check_valid_key_async(async_test_client: AsyncClient) -> None:
    """Test that the health check returns 200 with 'valid' using async client."""
    with (
        patch("fai.routes.health.VARIABLES") as mock_variables,
        patch("fai.routes.health.check_devin_api_key", new_callable=AsyncMock, return_value=ApiKeyStatus.VALID),
    ):
        mock_variables.SCRIBE_DEVIN_API_KEY = "test-key"

        response = await async_test_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "hello fernie!"
        assert data["checks"]["devin_api_key"] == "valid"


def test_health_check_invalid_key(test_client: TestClient) -> None:
    """Test that an expired/invalid key still returns 200 but reports 'invalid'."""
    with (
        patch("fai.routes.health.VARIABLES") as mock_variables,
        patch("fai.routes.health.check_devin_api_key", new_callable=AsyncMock, return_value=ApiKeyStatus.INVALID),
    ):
        mock_variables.SCRIBE_DEVIN_API_KEY = "expired-key"

        response = test_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "hello fernie!"
        assert data["checks"]["devin_api_key"] == "invalid"


def test_health_check_unreachable_api(test_client: TestClient) -> None:
    """Test that a Devin API outage still returns 200 but reports 'unreachable'."""
    with (
        patch("fai.routes.health.VARIABLES") as mock_variables,
        patch("fai.routes.health.check_devin_api_key", new_callable=AsyncMock, return_value=ApiKeyStatus.UNREACHABLE),
    ):
        mock_variables.SCRIBE_DEVIN_API_KEY = "some-key"

        response = test_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "hello fernie!"
        assert data["checks"]["devin_api_key"] == "unreachable"


def test_health_check_missing_key(test_client: TestClient) -> None:
    """Test that a missing key still returns 200 but reports 'missing'."""
    with patch("fai.routes.health.VARIABLES") as mock_variables:
        mock_variables.SCRIBE_DEVIN_API_KEY = None

        response = test_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "hello fernie!"
        assert data["checks"]["devin_api_key"] == "missing"


def test_health_check_empty_key(test_client: TestClient) -> None:
    """Test that an empty string key is treated as missing."""
    with patch("fai.routes.health.VARIABLES") as mock_variables:
        mock_variables.SCRIBE_DEVIN_API_KEY = ""

        response = test_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "hello fernie!"
        assert data["checks"]["devin_api_key"] == "missing"


def test_health_check_cache_hit(test_client: TestClient) -> None:
    """Test that repeated calls use the cached result and don't re-call the Devin API."""
    mock_check = AsyncMock(return_value=ApiKeyStatus.VALID)
    with (
        patch("fai.routes.health.VARIABLES") as mock_variables,
        patch("fai.routes.health.check_devin_api_key", mock_check),
    ):
        mock_variables.SCRIBE_DEVIN_API_KEY = "test-key"

        # First call — populates cache
        response1 = test_client.get("/health")
        assert response1.status_code == 200
        assert response1.json()["checks"]["devin_api_key"] == "valid"

        # Second call — should use cache (check_devin_api_key not called again)
        mock_check.return_value = ApiKeyStatus.INVALID  # would change if called
        response2 = test_client.get("/health")
        assert response2.status_code == 200
        assert response2.json()["checks"]["devin_api_key"] == "valid"  # still cached

        # check_devin_api_key should have been called only once
        assert mock_check.call_count == 1
