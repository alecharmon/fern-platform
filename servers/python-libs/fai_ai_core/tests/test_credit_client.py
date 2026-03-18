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


@pytest.mark.asyncio
async def test_log_usage_default_ask_fern_entry(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None

    mock_request = AsyncMock(return_value=mock_response)

    with patch.object(client, "_request_with_retry", mock_request):
        await client.log_usage(
            "example.docs.buildwithfern.com",
            question="How do I authenticate?",
            response_tokens=100,
        )

    body = mock_request.call_args[1]["json"]
    assert body["org_id"] == "org-from-resolver"
    assert body["site"] == "example.docs.buildwithfern.com"
    assert body["entry"] == {
        "type": "ask_fern",
        "metadata": {
            "question": "How do I authenticate?",
            "response_tokens": 100,
        },
    }


@pytest.mark.asyncio
async def test_log_usage_custom_entry_overrides_default(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None

    mock_request = AsyncMock(return_value=mock_response)

    custom_entry = {
        "type": "custom_action",
        "metadata": {"key": "value"},
    }

    with patch.object(client, "_request_with_retry", mock_request):
        await client.log_usage(
            "example.docs.buildwithfern.com",
            question="ignored question",
            response_tokens=999,
            entry=custom_entry,
        )

    body = mock_request.call_args[1]["json"]
    assert body["entry"] == custom_entry
    assert body["entry"]["type"] == "custom_action"
    assert "ask_fern" not in str(body["entry"]["type"])


@pytest.mark.asyncio
async def test_log_usage_entry_with_fern_writer_type(client: OrgAiCreditClient) -> None:
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None

    mock_request = AsyncMock(return_value=mock_response)

    fern_writer_entry = {
        "type": "fern_writer",
        "metadata": {
            "input_tokens": 500,
            "output_tokens": 1200,
            "model": "claude-3-opus",
        },
    }

    with patch.object(client, "_request_with_retry", mock_request):
        await client.log_usage(
            "writer.docs.buildwithfern.com",
            org_id="org-writer-456",
            entry=fern_writer_entry,
        )

    mock_request.assert_awaited_once()
    call_args = mock_request.call_args
    assert call_args[0][0] == "POST"
    assert "activity-with-credits" in call_args[0][1]

    body = call_args[1]["json"]
    assert body == {
        "org_id": "org-writer-456",
        "site": "writer.docs.buildwithfern.com",
        "entry": {
            "type": "fern_writer",
            "metadata": {
                "input_tokens": 500,
                "output_tokens": 1200,
                "model": "claude-3-opus",
            },
        },
    }


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
