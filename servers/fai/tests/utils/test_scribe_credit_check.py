from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from fai.utils.scribe.message_handler import handle_scribe_message


def _make_integration(org_id: str | None = None) -> MagicMock:
    integration = MagicMock()
    integration.org_id = org_id
    integration.slack_bot_token = "xoxb-test-token"
    integration.slack_bot_user_id = "U_BOT"
    integration.integration_id = "int-1"
    integration.github_repo = "org/repo"
    integration.settings = {}
    return integration


def _base_event() -> dict[str, Any]:
    return {
        "user": "U_USER",
        "text": "<@U_BOT> hello",
        "channel": "C_CHAN",
        "ts": "1111.2222",
        "thread_ts": "1111.2222",
        "files": [],
    }


def _mock_async_session_maker() -> Any:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    @asynccontextmanager
    async def _maker() -> AsyncIterator[AsyncMock]:
        yield mock_session

    return _maker


@pytest.mark.asyncio
async def test_credit_check_blocks_when_exhausted() -> None:
    integration = _make_integration(org_id="org-1")
    credit_client = AsyncMock()
    credit_result = MagicMock()
    credit_result.allowed = False
    credit_client.check_credits = AsyncMock(return_value=credit_result)

    with (
        patch("fai.utils.scribe.message_handler.get_scribe_integration", AsyncMock(return_value=integration)),
        patch("fai.utils.scribe.message_handler.get_credit_client", return_value=credit_client),
        patch("fai.utils.scribe.message_handler.is_credit_gated", return_value=True),
        patch("fai.utils.scribe.message_handler.unfurl_thread_links", AsyncMock(return_value=("hello", None))),
    ):
        resp = await handle_scribe_message(_base_event(), "T_TEAM")

    assert "credit limit reached" in resp.response_text.lower()
    assert resp.channel == "C_CHAN"


@pytest.mark.asyncio
async def test_credit_check_allows_when_entitled() -> None:
    integration = _make_integration(org_id="org-1")
    credit_client = AsyncMock()
    credit_result = MagicMock()
    credit_result.allowed = True
    credit_client.check_credits = AsyncMock(return_value=credit_result)

    mock_session = MagicMock()
    mock_session.id = "sess-1"
    mock_session.devin_session_id = "devin-1"
    mock_session.slack_bot_token = "xoxb-test-token"
    mock_session.status = "running"

    with (
        patch("fai.utils.scribe.message_handler.get_scribe_integration", AsyncMock(return_value=integration)),
        patch("fai.utils.scribe.message_handler.get_credit_client", return_value=credit_client),
        patch("fai.utils.scribe.message_handler.is_credit_gated", return_value=True),
        patch("fai.utils.scribe.message_handler.unfurl_thread_links", AsyncMock(return_value=("hello", None))),
        patch("fai.utils.scribe.message_handler.async_session_maker", _mock_async_session_maker()),
        patch(
            "fai.utils.scribe.message_handler.get_or_create_session",
            AsyncMock(return_value=(mock_session, True, [])),
        ),
        patch("fai.utils.scribe.message_handler.poll_devin_session", AsyncMock()),
    ):
        resp = await handle_scribe_message(_base_event(), "T_TEAM")

    assert "credit limit reached" not in resp.response_text.lower()


@pytest.mark.asyncio
async def test_credit_check_skipped_when_no_org_id() -> None:
    integration = _make_integration(org_id=None)
    credit_client = AsyncMock()
    credit_client.check_credits = AsyncMock(side_effect=AssertionError("should not be called"))

    mock_session = MagicMock()
    mock_session.id = "sess-1"
    mock_session.devin_session_id = "devin-1"
    mock_session.slack_bot_token = "xoxb-test-token"
    mock_session.status = "running"

    with (
        patch("fai.utils.scribe.message_handler.get_scribe_integration", AsyncMock(return_value=integration)),
        patch("fai.utils.scribe.message_handler.get_credit_client", return_value=credit_client),
        patch("fai.utils.scribe.message_handler.is_credit_gated", return_value=True),
        patch("fai.utils.scribe.message_handler.unfurl_thread_links", AsyncMock(return_value=("hello", None))),
        patch("fai.utils.scribe.message_handler.async_session_maker", _mock_async_session_maker()),
        patch(
            "fai.utils.scribe.message_handler.get_or_create_session",
            AsyncMock(return_value=(mock_session, True, [])),
        ),
        patch("fai.utils.scribe.message_handler.poll_devin_session", AsyncMock()),
    ):
        resp = await handle_scribe_message(_base_event(), "T_TEAM")

    assert "credit limit reached" not in resp.response_text.lower()
    credit_client.check_credits.assert_not_called()
