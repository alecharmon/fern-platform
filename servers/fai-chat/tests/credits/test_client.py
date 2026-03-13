import datetime
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import jwt
import pytest
from fai_ai_core.credits.client import OrgAiCreditClient
from fai_ai_core.credits.types import CreditCheckResult


@pytest.fixture
def client() -> OrgAiCreditClient:
    return OrgAiCreditClient(
        dashboard_url="https://dashboard.example.com",
        jwt_secret="test-secret-key-test-secret-key!",
        resolve_org_id=AsyncMock(return_value="org-from-resolver"),
        logger=logging.getLogger("test-credit-client"),
    )


@pytest.mark.asyncio
async def test_resolve_org_id_returns_provided_org_id(client: OrgAiCreditClient) -> None:
    result = await client._resolve_org_id("example.docs.buildwithfern.com", org_id="org-123")
    assert result == "org-123"


@pytest.mark.asyncio
async def test_resolve_org_id_caches_provided_org_id(client: OrgAiCreditClient) -> None:
    await client._resolve_org_id("example.docs.buildwithfern.com", org_id="org-123")
    result = await client._resolve_org_id("example.docs.buildwithfern.com")
    assert result == "org-123"


@pytest.mark.asyncio
async def test_resolve_org_id_fetches_from_fdr(client: OrgAiCreditClient) -> None:
    mock_resolver = AsyncMock(return_value="org-from-fdr")
    with patch.object(client, "_resolve_org_id_for_domain", mock_resolver):
        result = await client._resolve_org_id("example.docs.buildwithfern.com")
    assert result == "org-from-fdr"


@pytest.mark.asyncio
async def test_resolve_org_id_uses_lru_cache(client: OrgAiCreditClient) -> None:
    mock_fetch = AsyncMock(return_value="org-from-fdr")
    with patch.object(client, "_resolve_org_id_for_domain", mock_fetch):
        await client._resolve_org_id("example.docs.buildwithfern.com")
        await client._resolve_org_id("example.docs.buildwithfern.com")
    mock_fetch.assert_awaited_once()


@pytest.mark.asyncio
async def test_check_credits_returns_parsed_result(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {"allowed": True, "used": 50, "limit": 1000}
    mock_response.raise_for_status = lambda: None

    with (
        patch.object(client, "_resolve_org_id", new_callable=AsyncMock, return_value="org-123"),
        patch.object(client, "_request_with_retry", new_callable=AsyncMock, return_value=mock_response),
    ):
        result = await client.check_credits("example.docs.buildwithfern.com")

    assert result == CreditCheckResult(allowed=True, used=50, limit=1000)


@pytest.mark.asyncio
async def test_check_credits_uses_ttl_cache(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {"allowed": True, "used": 50, "limit": 1000}
    mock_response.raise_for_status = lambda: None

    mock_request = AsyncMock(return_value=mock_response)
    with (
        patch.object(client, "_resolve_org_id", new_callable=AsyncMock, return_value="org-123"),
        patch.object(client, "_request_with_retry", mock_request),
    ):
        await client.check_credits("example.docs.buildwithfern.com")
        await client.check_credits("example.docs.buildwithfern.com")

    mock_request.assert_awaited_once()


@pytest.mark.asyncio
async def test_check_credits_fails_open_on_http_error(client: OrgAiCreditClient) -> None:
    with (
        patch.object(client, "_resolve_org_id", new_callable=AsyncMock, return_value="org-123"),
        patch.object(
            client,
            "_request_with_retry",
            new_callable=AsyncMock,
            side_effect=httpx.HTTPError("connection error"),
        ),
    ):
        result = await client.check_credits("example.docs.buildwithfern.com")

    assert result.allowed is True
    assert result.used == 0
    assert result.limit == 0


@pytest.mark.asyncio
async def test_check_credits_fails_open_on_resolve_error(client: OrgAiCreditClient) -> None:
    with patch.object(
        client,
        "_resolve_org_id",
        new_callable=AsyncMock,
        side_effect=Exception("resolution failed"),
    ):
        result = await client.check_credits("example.docs.buildwithfern.com")

    assert result.allowed is True
    assert result.used == 0
    assert result.limit == 0


@pytest.mark.asyncio
async def test_log_usage_posts_to_dashboard(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.raise_for_status = lambda: None

    mock_request = AsyncMock(return_value=mock_response)
    entry = {"query": "test", "model": "claude"}

    with (
        patch.object(client, "_resolve_org_id", new_callable=AsyncMock, return_value="org-123"),
        patch.object(client, "_request_with_retry", mock_request),
    ):
        await client.log_usage("example.docs.buildwithfern.com", entry)

    mock_request.assert_awaited_once()
    call_kwargs = mock_request.call_args
    assert call_kwargs[0][0] == "POST"
    assert "activity-with-credits" in call_kwargs[0][1]


@pytest.mark.asyncio
async def test_log_usage_swallows_errors(client: OrgAiCreditClient) -> None:
    with (
        patch.object(client, "_resolve_org_id", new_callable=AsyncMock, return_value="org-123"),
        patch.object(
            client,
            "_request_with_retry",
            new_callable=AsyncMock,
            side_effect=httpx.HTTPError("connection error"),
        ),
    ):
        await client.log_usage("example.docs.buildwithfern.com", {"query": "test"})


@pytest.mark.asyncio
async def test_resolve_org_id_calls_correct_fdr_sdk_path() -> None:
    mock_response = MagicMock()
    mock_response.org = "resolved-org"

    mock_fdr_client = MagicMock()
    mock_fdr_client.docs.v_2.read.get_docs_url_metadata = AsyncMock(return_value=mock_response)

    with patch("src.credits.client.get_fdr_client", return_value=mock_fdr_client):
        from src.credits.client import _resolve_org_id

        result = await _resolve_org_id("example.docs.buildwithfern.com")

    assert result == "resolved-org"
    mock_fdr_client.docs.v_2.read.get_docs_url_metadata.assert_awaited_once_with(url="example.docs.buildwithfern.com")


def test_sign_jwt_produces_valid_token(client: OrgAiCreditClient) -> None:
    token = client._sign_jwt()
    decoded = jwt.decode(
        token, "test-secret-key-test-secret-key!", algorithms=["HS256"], audience="dashboard-activity-log"
    )
    assert decoded["service"] == "fai"
    assert decoded["iss"] == "https://buildwithfern.com"
    assert decoded["aud"] == "dashboard-activity-log"
    assert "exp" in decoded
    exp_dt = datetime.datetime.fromtimestamp(decoded["exp"], tz=datetime.UTC)
    now = datetime.datetime.now(tz=datetime.UTC)
    assert exp_dt > now
    assert exp_dt < now + datetime.timedelta(hours=2)
