from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from fai.utils.scribe.session_manager import resume_active_sessions


def _make_session_record(
    session_id: str = "sess-1",
    devin_session_id: str = "devin-1",
    integration_id: str = "int-1",
    status: str = "running",
) -> MagicMock:
    record = MagicMock()
    record.id = session_id
    record.devin_session_id = devin_session_id
    record.integration_id = integration_id
    record.slack_channel = "C123"
    record.slack_thread_ts = "ts-1"
    record.status = status
    return record


def _make_integration(
    github_repo: str = "owner/repo",
    org_id: str | None = "test-org",
    slack_bot_token: str | None = "xoxb-test",
) -> MagicMock:
    integration = MagicMock()
    integration.github_repo = github_repo
    integration.org_id = org_id
    integration.slack_bot_token = slack_bot_token
    return integration


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_manager.poll_devin_session", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_manager.get_scribe_integration_by_id", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_manager.async_session_maker")
async def test_resume_passes_github_repo_and_org_id(
    mock_session_maker: MagicMock,
    mock_get_integration: AsyncMock,
    mock_poll: AsyncMock,
) -> None:
    session_record = _make_session_record()
    integration = _make_integration(github_repo="acme/docs", org_id="acme-org")

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [session_record]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=mock_db)
    cm.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = cm

    mock_get_integration.return_value = integration

    await resume_active_sessions()

    mock_poll.assert_called_once_with(
        session_record.id,
        session_record.devin_session_id,
        session_record.slack_channel,
        session_record.slack_thread_ts,
        integration.slack_bot_token,
        github_repo="acme/docs",
        org_id="acme-org",
    )


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_manager.poll_devin_session", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_manager.get_scribe_integration_by_id", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_manager.async_session_maker")
async def test_resume_passes_none_org_id_when_not_set(
    mock_session_maker: MagicMock,
    mock_get_integration: AsyncMock,
    mock_poll: AsyncMock,
) -> None:
    session_record = _make_session_record()
    integration = _make_integration(github_repo="owner/repo", org_id=None)

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [session_record]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=mock_db)
    cm.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = cm

    mock_get_integration.return_value = integration

    await resume_active_sessions()

    mock_poll.assert_called_once_with(
        session_record.id,
        session_record.devin_session_id,
        session_record.slack_channel,
        session_record.slack_thread_ts,
        integration.slack_bot_token,
        github_repo="owner/repo",
        org_id=None,
    )


@pytest.mark.asyncio
@patch("fai.utils.scribe.session_manager.poll_devin_session", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_manager.get_scribe_integration_by_id", new_callable=AsyncMock)
@patch("fai.utils.scribe.session_manager.async_session_maker")
async def test_resume_skips_session_without_bot_token(
    mock_session_maker: MagicMock,
    mock_get_integration: AsyncMock,
    mock_poll: AsyncMock,
) -> None:
    session_record = _make_session_record()
    integration = _make_integration(slack_bot_token=None)

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [session_record]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=mock_db)
    cm.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = cm

    mock_get_integration.return_value = integration

    await resume_active_sessions()

    mock_poll.assert_not_called()
