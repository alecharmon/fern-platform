"""End-to-end test: new scribe session → Devin terminates → credits logged to dashboard."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from fai.credits.client import OrgAiCreditClient
from fai.utils.scribe.session_poller import poll_devin_session


def _make_devin_status(
    status_enum: str = "running",
    accus_consumed: int = 0,
    messages: list[dict[str, Any]] | None = None,
    pull_requests: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "status_enum": status_enum,
        "status": status_enum,
        "messages": messages or [],
        "pull_request": None,
        "accus_consumed": accus_consumed,
        "pull_requests": pull_requests or [],
    }


def _make_session_record() -> MagicMock:
    record = MagicMock()
    record.last_message_event_id = None
    record.pr_url = None
    record.status = "running"
    return record


def _mock_db_context() -> AsyncMock:
    db = AsyncMock()
    db.commit = AsyncMock()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=db)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_poller.send_slack_message", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.get_scribe_session_by_id")
@patch("fai.utils.scribe.session_poller.get_devin_session_status", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.async_session_maker")
async def test_session_lifecycle_logs_credits_on_termination(
    mock_session_maker: MagicMock,
    mock_get_status: AsyncMock,
    mock_get_session: MagicMock,
    mock_send_slack: AsyncMock,
) -> None:
    """Simulate: session starts running → accumulates ACCUs → stops → credits logged."""

    # Devin returns "running" with 10 ACCUs on first poll, then "stopped" with 50 ACCUs
    mock_get_status.side_effect = [
        _make_devin_status(status_enum="running", accus_consumed=10),
        _make_devin_status(status_enum="stopped", accus_consumed=50),
    ]

    session_record = _make_session_record()
    mock_get_session.return_value = session_record
    mock_session_maker.side_effect = lambda: _mock_db_context()

    # Use a real OrgAiCreditClient but intercept the HTTP call
    captured_requests: list[dict[str, Any]] = []

    async def mock_transport(request: httpx.Request) -> httpx.Response:
        body = None
        if request.content:
            import json

            body = json.loads(request.content)
        captured_requests.append(
            {
                "method": str(request.method),
                "url": str(request.url),
                "body": body,
                "headers": dict(request.headers),
            }
        )
        return httpx.Response(200, json={"success": True})

    mock_client = OrgAiCreditClient(
        dashboard_url="https://dashboard.test.com",
        jwt_secret="test-secret-key-for-jwt-signing",
        resolve_org_id=AsyncMock(return_value="test-org"),
        logger=MagicMock(),
    )
    mock_client._http = httpx.AsyncClient(transport=httpx.MockTransport(mock_transport))

    with (
        patch("fai.utils.scribe.session_poller.get_credit_client", return_value=mock_client),
        patch("fai.utils.scribe.session_poller.is_credit_gated", return_value=True),
    ):
        await poll_devin_session(
            session_id="sess-e2e",
            devin_session_id="devin-e2e",
            slack_channel="C999",
            slack_thread_ts="ts-e2e",
            bot_token="xoxb-test",
            github_repo="acme/docs",
            org_id="acme-org",
        )

    # Should have made 2 credit log calls (one per poll cycle with accus > 0)
    credit_calls = [r for r in captured_requests if "activity-with-credits" in r["url"]]
    assert len(credit_calls) == 2, f"Expected 2 credit log calls, got {len(credit_calls)}: {credit_calls}"

    # Verify first call (running, 10 ACCUs)
    first_body = credit_calls[0]["body"]
    assert first_body["org_id"] == "acme-org"
    assert first_body["site"] == "acme/docs"
    assert first_body["entry"]["type"] == "fern_writer"
    assert first_body["entry"]["metadata"]["response_tokens"] == 10
    assert first_body["entry"]["metadata"]["devin_session_id"] == "devin-e2e"

    # Verify second call (stopped, 50 ACCUs)
    second_body = credit_calls[1]["body"]
    assert second_body["org_id"] == "acme-org"
    assert second_body["entry"]["metadata"]["response_tokens"] == 50
    assert second_body["entry"]["metadata"]["status"] == "stopped"

    # Verify JWT auth header was sent
    for call in credit_calls:
        assert "authorization" in call["headers"]
        assert call["headers"]["authorization"].startswith("Bearer ")

    # Verify the dashboard URL was correct
    assert credit_calls[0]["url"] == "https://dashboard.test.com/api/services/activity-log/activity-with-credits"


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_poller.send_slack_message", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.get_scribe_session_by_id")
@patch("fai.utils.scribe.session_poller.get_devin_session_status", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.async_session_maker")
async def test_no_credits_logged_without_org_id(
    mock_session_maker: MagicMock,
    mock_get_status: AsyncMock,
    mock_get_session: MagicMock,
    mock_send_slack: AsyncMock,
) -> None:
    """Session without org_id should never call the dashboard."""

    mock_get_status.return_value = _make_devin_status(status_enum="stopped", accus_consumed=100)

    session_record = _make_session_record()
    mock_get_session.return_value = session_record
    mock_session_maker.side_effect = lambda: _mock_db_context()

    captured_requests: list[dict[str, Any]] = []

    async def mock_transport(request: httpx.Request) -> httpx.Response:
        captured_requests.append({"url": str(request.url)})
        return httpx.Response(200, json={"success": True})

    mock_client = OrgAiCreditClient(
        dashboard_url="https://dashboard.test.com",
        jwt_secret="test-secret",
        resolve_org_id=AsyncMock(return_value=""),
        logger=MagicMock(),
    )
    mock_client._http = httpx.AsyncClient(transport=httpx.MockTransport(mock_transport))

    with (
        patch("fai.utils.scribe.session_poller.get_credit_client", return_value=mock_client),
        patch("fai.utils.scribe.session_poller.is_credit_gated", return_value=True),
    ):
        await poll_devin_session(
            session_id="sess-no-org",
            devin_session_id="devin-no-org",
            slack_channel="C999",
            slack_thread_ts="ts-1",
            bot_token="xoxb-test",
            github_repo="acme/docs",
            org_id=None,
        )

    assert len(captured_requests) == 0, f"Expected no dashboard calls, got {len(captured_requests)}"


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_poller.send_slack_message", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.get_scribe_session_by_id")
@patch("fai.utils.scribe.session_poller.get_devin_session_status", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.async_session_maker")
async def test_no_credits_logged_when_not_credit_gated(
    mock_session_maker: MagicMock,
    mock_get_status: AsyncMock,
    mock_get_session: MagicMock,
    mock_send_slack: AsyncMock,
) -> None:
    """Org not in credit-gated list should never call the dashboard."""

    mock_get_status.return_value = _make_devin_status(status_enum="stopped", accus_consumed=100)

    session_record = _make_session_record()
    mock_get_session.return_value = session_record
    mock_session_maker.side_effect = lambda: _mock_db_context()

    captured_requests: list[dict[str, Any]] = []

    async def mock_transport(request: httpx.Request) -> httpx.Response:
        captured_requests.append({"url": str(request.url)})
        return httpx.Response(200, json={"success": True})

    mock_client = OrgAiCreditClient(
        dashboard_url="https://dashboard.test.com",
        jwt_secret="test-secret",
        resolve_org_id=AsyncMock(return_value=""),
        logger=MagicMock(),
    )
    mock_client._http = httpx.AsyncClient(transport=httpx.MockTransport(mock_transport))

    with (
        patch("fai.utils.scribe.session_poller.get_credit_client", return_value=mock_client),
        patch("fai.utils.scribe.session_poller.is_credit_gated", return_value=False),
    ):
        await poll_devin_session(
            session_id="sess-ungated",
            devin_session_id="devin-ungated",
            slack_channel="C999",
            slack_thread_ts="ts-1",
            bot_token="xoxb-test",
            github_repo="acme/docs",
            org_id="some-org",
        )

    assert len(captured_requests) == 0, f"Expected no dashboard calls, got {len(captured_requests)}"
