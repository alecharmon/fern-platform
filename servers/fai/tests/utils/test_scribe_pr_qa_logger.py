from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest

from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb
from fai.utils.scribe.pr_qa_logger import (
    QA_CHANNEL_ID,
    log_install_for_qa,
    log_merged_pr_for_qa,
    log_pr_created_for_qa,
)


@pytest.fixture
def mock_integration() -> ScribeIntegrationDb:
    integration = MagicMock(spec=ScribeIntegrationDb)
    integration.integration_id = "test-integration-123"
    integration.slack_team_name = "Test Org"
    integration.github_repo = "test-org/test-repo"
    return integration


@pytest.fixture
def mock_session() -> ScribeSessionDb:
    session = MagicMock(spec=ScribeSessionDb)
    session.id = "test-session-456"
    session.integration_id = "test-integration-123"
    session.pr_url = "https://github.com/test-org/test-repo/pull/42"
    session.devin_session_url = "https://app.devin.ai/sessions/test-session"
    session.slack_thread_ts = "1234567890.123456"
    session.slack_channel = "C0123456789"
    return session


class TestLogInstallForQA:
    @pytest.mark.asyncio
    async def test_sends_install_notification(self, mock_integration: ScribeIntegrationDb) -> None:
        with (
            patch("fai.utils.scribe.pr_qa_logger.send_slack_message", new_callable=AsyncMock) as mock_send,
            patch("fai.utils.scribe.pr_qa_logger.VARIABLES") as mock_vars,
        ):
            mock_vars.SCRIBE_SLACK_BOT_TOKEN = "test-bot-token"

            await log_install_for_qa(mock_integration)

            mock_send.assert_called_once()
            call_args = mock_send.call_args
            assert call_args.kwargs["channel"] == QA_CHANNEL_ID
            assert call_args.kwargs["bot_token"] == "test-bot-token"
            assert call_args.kwargs["message_key"] == "scribe_install_test-integration-123"

            message_text = call_args.kwargs["text"]
            assert "*FERN WRITER SLACK APP INSTALLED* 🎉" in message_text
            assert "*Org:* Test Org" in message_text
            assert "*Repository:* `test-org/test-repo`" in message_text

    @pytest.mark.asyncio
    async def test_handles_unknown_org_name(self, mock_integration: ScribeIntegrationDb) -> None:
        mock_integration.slack_team_name = None

        with (
            patch("fai.utils.scribe.pr_qa_logger.send_slack_message", new_callable=AsyncMock) as mock_send,
            patch("fai.utils.scribe.pr_qa_logger.VARIABLES") as mock_vars,
        ):
            mock_vars.SCRIBE_SLACK_BOT_TOKEN = "test-bot-token"

            await log_install_for_qa(mock_integration)

            message_text = mock_send.call_args.kwargs["text"]
            assert "*Org:* Unknown" in message_text


class TestLogPRCreatedForQA:
    @pytest.mark.asyncio
    async def test_sends_pr_created_notification(
        self, mock_session: ScribeSessionDb, mock_integration: ScribeIntegrationDb
    ) -> None:
        with (
            patch(
                "fai.utils.scribe.pr_qa_logger.get_scribe_integration_by_id", new_callable=AsyncMock
            ) as mock_get_integration,
            patch("fai.utils.scribe.pr_qa_logger.send_slack_message", new_callable=AsyncMock) as mock_send,
            patch("fai.utils.scribe.pr_qa_logger.VARIABLES") as mock_vars,
        ):
            mock_get_integration.return_value = mock_integration
            mock_vars.SCRIBE_SLACK_BOT_TOKEN = "test-bot-token"

            await log_pr_created_for_qa(mock_session)

            mock_send.assert_called_once()
            call_args = mock_send.call_args
            assert call_args.kwargs["channel"] == QA_CHANNEL_ID
            assert call_args.kwargs["bot_token"] == "test-bot-token"
            assert call_args.kwargs["message_key"] == "scribe_pr_created_test-session-456"

            message_text = call_args.kwargs["text"]
            assert "*SCRIBE PR CREATED* 🚀" in message_text
            assert "*Org:* Test Org" in message_text
            assert "*Pull request:* https://github.com/test-org/test-repo/pull/42" in message_text
            assert "*Devin Session:* https://app.devin.ai/sessions/test-session" in message_text
            assert (
                "*Slack Thread:* https://slack.com/app_redirect?channel=C0123456789&message_ts=1234567890.123456"
                in message_text
            )

    @pytest.mark.asyncio
    async def test_handles_missing_optional_fields(
        self, mock_session: ScribeSessionDb, mock_integration: ScribeIntegrationDb
    ) -> None:
        mock_session.devin_session_url = None
        mock_session.slack_thread_ts = None

        with (
            patch(
                "fai.utils.scribe.pr_qa_logger.get_scribe_integration_by_id", new_callable=AsyncMock
            ) as mock_get_integration,
            patch("fai.utils.scribe.pr_qa_logger.send_slack_message", new_callable=AsyncMock) as mock_send,
            patch("fai.utils.scribe.pr_qa_logger.VARIABLES") as mock_vars,
        ):
            mock_get_integration.return_value = mock_integration
            mock_vars.SCRIBE_SLACK_BOT_TOKEN = "test-bot-token"

            await log_pr_created_for_qa(mock_session)

            message_text = mock_send.call_args.kwargs["text"]
            assert "*Devin Session:*" not in message_text
            assert "*Slack Thread:*" not in message_text


class TestLogMergedPRForQA:
    @pytest.mark.asyncio
    async def test_sends_merged_pr_notification(
        self, mock_session: ScribeSessionDb, mock_integration: ScribeIntegrationDb
    ) -> None:
        with (
            patch(
                "fai.utils.scribe.pr_qa_logger.get_scribe_integration_by_id", new_callable=AsyncMock
            ) as mock_get_integration,
            patch("fai.utils.scribe.pr_qa_logger.send_slack_message", new_callable=AsyncMock) as mock_send,
            patch("fai.utils.scribe.pr_qa_logger.VARIABLES") as mock_vars,
        ):
            mock_get_integration.return_value = mock_integration
            mock_vars.SCRIBE_SLACK_BOT_TOKEN = "test-bot-token"

            await log_merged_pr_for_qa(mock_session, "merged")

            mock_send.assert_called_once()
            call_args = mock_send.call_args
            assert call_args.kwargs["channel"] == QA_CHANNEL_ID
            assert call_args.kwargs["bot_token"] == "test-bot-token"
            assert call_args.kwargs["message_key"] == "scribe_pr_test-session-456_merged"

            message_text = call_args.kwargs["text"]
            assert "*SCRIBE PR MERGED* ✅" in message_text
            assert "*Org:* Test Org" in message_text
            assert "*Pull request:* https://github.com/test-org/test-repo/pull/42" in message_text
            assert "*Devin Session:* https://app.devin.ai/sessions/test-session" in message_text
            assert (
                "*Slack Thread:* https://slack.com/app_redirect?channel=C0123456789&message_ts=1234567890.123456"
                in message_text
            )

    @pytest.mark.asyncio
    async def test_sends_closed_pr_notification(
        self, mock_session: ScribeSessionDb, mock_integration: ScribeIntegrationDb
    ) -> None:
        with (
            patch(
                "fai.utils.scribe.pr_qa_logger.get_scribe_integration_by_id", new_callable=AsyncMock
            ) as mock_get_integration,
            patch("fai.utils.scribe.pr_qa_logger.send_slack_message", new_callable=AsyncMock) as mock_send,
            patch("fai.utils.scribe.pr_qa_logger.VARIABLES") as mock_vars,
        ):
            mock_get_integration.return_value = mock_integration
            mock_vars.SCRIBE_SLACK_BOT_TOKEN = "test-bot-token"

            await log_merged_pr_for_qa(mock_session, "closed")

            message_text = mock_send.call_args.kwargs["text"]
            assert "*SCRIBE PR CLOSED* ❌" in message_text

    @pytest.mark.asyncio
    async def test_updated_format_uses_org_not_team(
        self, mock_session: ScribeSessionDb, mock_integration: ScribeIntegrationDb
    ) -> None:
        with (
            patch(
                "fai.utils.scribe.pr_qa_logger.get_scribe_integration_by_id", new_callable=AsyncMock
            ) as mock_get_integration,
            patch("fai.utils.scribe.pr_qa_logger.send_slack_message", new_callable=AsyncMock) as mock_send,
            patch("fai.utils.scribe.pr_qa_logger.VARIABLES") as mock_vars,
        ):
            mock_get_integration.return_value = mock_integration
            mock_vars.SCRIBE_SLACK_BOT_TOKEN = "test-bot-token"

            await log_merged_pr_for_qa(mock_session, "merged")

            message_text = mock_send.call_args.kwargs["text"]
            assert "*Org:*" in message_text
            assert "*Pull request:*" in message_text
            assert "*Team:*" not in message_text
            assert "*Repository:*" not in message_text
            assert "*PR URL:*" not in message_text
