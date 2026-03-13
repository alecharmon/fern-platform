import datetime
import logging
from unittest.mock import AsyncMock, patch

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
async def test_resolve_org_id_uses_injected_resolver_once(client: OrgAiCreditClient) -> None:
    await client._resolve_org_id("example.docs.buildwithfern.com")
    await client._resolve_org_id("example.docs.buildwithfern.com")

    client._resolve_org_id_for_domain.assert_awaited_once_with("example.docs.buildwithfern.com")


@pytest.mark.asyncio
async def test_check_credits_returns_parsed_result(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.json.return_value = {"allowed": True, "used": 50, "limit": 1000}
    mock_response.raise_for_status = lambda: None

    with patch.object(client, "_request_with_retry", new_callable=AsyncMock, return_value=mock_response):
        result = await client.check_credits("example.docs.buildwithfern.com")

    assert result == CreditCheckResult(allowed=True, used=50, limit=1000)


@pytest.mark.asyncio
async def test_check_credits_fails_open_on_resolve_error(client: OrgAiCreditClient) -> None:
    client._resolve_org_id_for_domain.side_effect = Exception("resolution failed")

    result = await client.check_credits("example.docs.buildwithfern.com")

    assert result == CreditCheckResult(allowed=True, used=0, limit=0)


@pytest.mark.asyncio
async def test_log_usage_posts_correct_schema(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None

    mock_request = AsyncMock(return_value=mock_response)

    with patch.object(client, "_request_with_retry", mock_request):
        await client.log_usage("example.docs.buildwithfern.com", question="What is Fern?", response_tokens=42)

    mock_request.assert_awaited_once()
    call_args = mock_request.call_args
    assert call_args[0][0] == "POST"
    assert "activity-with-credits" in call_args[0][1]

    body = call_args[1]["json"]
    assert body["org_id"] == "org-from-resolver"
    assert body["site"] == "example.docs.buildwithfern.com"
    assert body["entry"]["type"] == "ask_fern"
    assert body["entry"]["metadata"]["question"] == "What is Fern?"
    assert body["entry"]["metadata"]["response_tokens"] == 42


def test_sign_jwt_produces_valid_token(client: OrgAiCreditClient) -> None:
    token = client._sign_jwt()
    decoded = jwt.decode(
        token, "test-secret-key-test-secret-key!", algorithms=["HS256"], audience="dashboard-activity-log"
    )

    assert decoded["service"] == "fai"
    assert decoded["iss"] == "https://buildwithfern.com"
    assert decoded["aud"] == "dashboard-activity-log"
    exp_dt = datetime.datetime.fromtimestamp(decoded["exp"], tz=datetime.UTC)
    now = datetime.datetime.now(tz=datetime.UTC)
    assert exp_dt > now
    assert exp_dt < now + datetime.timedelta(hours=2)
