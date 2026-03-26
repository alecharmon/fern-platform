from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from fai.utils.scribe.session_poller import poll_devin_session


def _make_status(
    status_enum: str = "stopped",
    pull_requests: list[Any] | None = None,
) -> dict[str, Any]:
    return {
        "status_enum": status_enum,
        "status": status_enum,
        "messages": [],
        "pull_request": None,
        "pull_requests": pull_requests or [],
    }


def _make_session_record() -> MagicMock:
    record = MagicMock()
    record.last_message_event_id = None
    record.pr_url = None
    record.status = "running"
    return record


def _mock_db_session() -> AsyncMock:
    db = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.fixture
def mock_db_context() -> tuple[Any, AsyncMock]:
    db = _mock_db_session()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=db)
    cm.__aexit__ = AsyncMock(return_value=False)

    def factory() -> AsyncMock:
        return cm

    return factory, db


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_poller.send_slack_message", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.get_scribe_session_by_id")
@patch("fai.utils.scribe.session_poller.get_devin_session_status", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.async_session_maker")
@patch("fai.utils.scribe.session_poller.is_credit_gated", return_value=True)
@patch("fai.utils.scribe.session_poller.get_credit_client")
async def test_poller_logs_flat_credit_usage(
    mock_get_credit_client: MagicMock,
    mock_is_credit_gated: MagicMock,
    mock_session_maker: MagicMock,
    mock_get_status: AsyncMock,
    mock_get_session: MagicMock,
    mock_send_slack: AsyncMock,
) -> None:
    mock_credit_client = AsyncMock()
    mock_get_credit_client.return_value = mock_credit_client

    mock_get_status.return_value = _make_status(status_enum="stopped")

    session_record = _make_session_record()
    mock_get_session.return_value = session_record

    db = _mock_db_session()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=db)
    cm.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = cm

    await poll_devin_session(
        session_id="sess-1",
        devin_session_id="devin-1",
        slack_channel="C123",
        slack_thread_ts="ts-1",
        bot_token="xoxb-test",
        github_repo="owner/repo",
        org_id="org-1",
    )

    mock_credit_client.log_usage.assert_called_once()
    call_kwargs = mock_credit_client.log_usage.call_args.kwargs
    assert call_kwargs["domain"] == "owner/repo"
    assert call_kwargs["org_id"] == "org-1"
    entry = call_kwargs["entry"]
    assert entry["type"] == "fern_writer"
    assert entry["metadata"]["response_tokens"] == 50
    assert entry["metadata"]["devin_session_id"] == "devin-1"


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_poller.send_slack_message", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.get_scribe_session_by_id")
@patch("fai.utils.scribe.session_poller.get_devin_session_status", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.async_session_maker")
@patch("fai.utils.scribe.session_poller.get_credit_client")
async def test_poller_skips_credit_logging_when_no_org_id(
    mock_get_credit_client: MagicMock,
    mock_session_maker: MagicMock,
    mock_get_status: AsyncMock,
    mock_get_session: MagicMock,
    mock_send_slack: AsyncMock,
) -> None:
    mock_get_status.return_value = _make_status(status_enum="stopped")

    session_record = _make_session_record()
    mock_get_session.return_value = session_record

    db = _mock_db_session()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=db)
    cm.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = cm

    await poll_devin_session(
        session_id="sess-1",
        devin_session_id="devin-1",
        slack_channel="C123",
        slack_thread_ts="ts-1",
        bot_token="xoxb-test",
        github_repo="owner/repo",
        org_id=None,
    )

    mock_get_credit_client.assert_not_called()


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_poller.send_slack_message", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.get_scribe_session_by_id")
@patch("fai.utils.scribe.session_poller.get_devin_session_status", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_poller.async_session_maker")
@patch("fai.utils.scribe.session_poller.is_credit_gated", return_value=True)
@patch("fai.utils.scribe.session_poller.get_credit_client")
async def test_poller_logs_flat_credits_even_when_accus_zero(
    mock_get_credit_client: MagicMock,
    mock_is_credit_gated: MagicMock,
    mock_session_maker: MagicMock,
    mock_get_status: AsyncMock,
    mock_get_session: MagicMock,
    mock_send_slack: AsyncMock,
) -> None:
    mock_credit_client = AsyncMock()
    mock_get_credit_client.return_value = mock_credit_client

    mock_get_status.return_value = _make_status(status_enum="stopped")

    session_record = _make_session_record()
    mock_get_session.return_value = session_record

    db = _mock_db_session()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=db)
    cm.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = cm

    await poll_devin_session(
        session_id="sess-1",
        devin_session_id="devin-1",
        slack_channel="C123",
        slack_thread_ts="ts-1",
        bot_token="xoxb-test",
        github_repo="owner/repo",
        org_id="org-1",
    )

    mock_credit_client.log_usage.assert_called_once()
    call_kwargs = mock_credit_client.log_usage.call_args[1]
    assert call_kwargs["entry"]["metadata"]["response_tokens"] == 50
