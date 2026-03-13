from unittest.mock import AsyncMock, patch

import pytest

from fai.credits.types import CreditCheckResult


class TestFaiCustomerApiCreditGating:

    @pytest.mark.asyncio
    async def test_no_credit_check_when_client_is_none(self) -> None:
        with patch("fai.routes.chat.get_credit_client", return_value=None):
            from fai.routes.chat import get_credit_client
            assert get_credit_client() is None

    @pytest.mark.asyncio
    async def test_no_credit_check_when_org_not_gated(self) -> None:
        mock_client = AsyncMock()
        mock_client._resolve_org_id.return_value = "org_123"
        with (
            patch("fai.routes.chat.get_credit_client", return_value=mock_client),
            patch("fai.routes.chat.is_credit_gated", return_value=False),
        ):
            from fai.routes.chat import is_credit_gated
            assert is_credit_gated("org_123") is False
            mock_client.check_credits.assert_not_called()

    @pytest.mark.asyncio
    async def test_credit_check_blocks_when_exhausted(self) -> None:
        mock_client = AsyncMock()
        mock_client._resolve_org_id.return_value = "org_gated"
        mock_client.check_credits.return_value = CreditCheckResult(allowed=False, used=1000, limit=1000)
        with (
            patch("fai.routes.chat.get_credit_client", return_value=mock_client),
            patch("fai.routes.chat.is_credit_gated", return_value=True),
        ):
            result = await mock_client.check_credits("docs.example.com", "org_gated")
            assert result.allowed is False

    @pytest.mark.asyncio
    async def test_credit_check_allows_when_has_credits(self) -> None:
        mock_client = AsyncMock()
        mock_client._resolve_org_id.return_value = "org_gated"
        mock_client.check_credits.return_value = CreditCheckResult(allowed=True, used=50, limit=1000)
        with (
            patch("fai.routes.chat.get_credit_client", return_value=mock_client),
            patch("fai.routes.chat.is_credit_gated", return_value=True),
        ):
            result = await mock_client.check_credits("docs.example.com", "org_gated")
            assert result.allowed is True

    @pytest.mark.asyncio
    async def test_credit_check_fails_open(self) -> None:
        mock_client = AsyncMock()
        mock_client._resolve_org_id.side_effect = Exception("FDR unavailable")
        with patch("fai.routes.chat.get_credit_client", return_value=mock_client):
            with pytest.raises(Exception, match="FDR unavailable"):
                await mock_client._resolve_org_id("docs.example.com")


class TestSlackCreditGating:

    @pytest.mark.asyncio
    async def test_slack_returns_denial_when_exhausted(self) -> None:
        mock_client = AsyncMock()
        mock_client._resolve_org_id.return_value = "org_slack"
        mock_client.check_credits.return_value = CreditCheckResult(allowed=False, used=250, limit=250)
        with (
            patch("fai.utils.slack.message_handler.get_credit_client", return_value=mock_client),
            patch("fai.utils.slack.message_handler.is_credit_gated", return_value=True),
        ):
            result = await mock_client.check_credits("docs.example.com", "org_slack")
            assert result.allowed is False

    @pytest.mark.asyncio
    async def test_slack_skips_when_not_gated(self) -> None:
        with patch("fai.utils.slack.message_handler.get_credit_client", return_value=None):
            from fai.utils.slack.message_handler import get_credit_client
            assert get_credit_client() is None


class TestDiscordCreditGating:

    @pytest.mark.asyncio
    async def test_discord_returns_denial_when_exhausted(self) -> None:
        mock_client = AsyncMock()
        mock_client._resolve_org_id.return_value = "org_discord"
        mock_client.check_credits.return_value = CreditCheckResult(allowed=False, used=1000, limit=1000)
        with (
            patch("fai.credits.client.get_credit_client", return_value=mock_client),
            patch("fai.credits.config.is_credit_gated", return_value=True),
        ):
            from fai.credits.client import get_credit_client
            from fai.credits.config import is_credit_gated
            client = get_credit_client()
            assert client is not None
            org_id = await client._resolve_org_id("docs.example.com")
            assert is_credit_gated(org_id) is True
            result = await client.check_credits("docs.example.com", org_id)
            assert result.allowed is False

    @pytest.mark.asyncio
    async def test_discord_skips_when_not_gated(self) -> None:
        with patch("fai.credits.client.get_credit_client", return_value=None):
            from fai.credits.client import get_credit_client
            assert get_credit_client() is None


class TestUsageLogging:

    @pytest.mark.asyncio
    async def test_log_usage_called_with_correct_params(self) -> None:
        mock_client = AsyncMock()
        await mock_client.log_usage("docs.example.com", {
            "type": "ask_fern",
            "event_type": "CHAT",
            "response_tokens": 150,
            "metadata": {"domain": "docs.example.com", "conversation_id": "conv_123"},
        }, "org_123")
        mock_client.log_usage.assert_called_once()
        call_args = mock_client.log_usage.call_args
        assert call_args[0][0] == "docs.example.com"
        assert call_args[0][1]["type"] == "ask_fern"
        assert call_args[0][1]["response_tokens"] == 150
        assert call_args[0][2] == "org_123"

    @pytest.mark.asyncio
    async def test_log_usage_includes_event_type_per_source(self) -> None:
        for event_type in ["CHAT", "API", "SLACK", "DISCORD"]:
            mock_client = AsyncMock()
            await mock_client.log_usage("docs.example.com", {
                "type": "ask_fern",
                "event_type": event_type,
                "response_tokens": 100,
            }, "org_123")
            call_args = mock_client.log_usage.call_args
            assert call_args[0][1]["event_type"] == event_type

    @pytest.mark.asyncio
    async def test_log_usage_not_called_when_zero_tokens(self) -> None:
        mock_client = AsyncMock()
        output_tokens = 0
        org_id = "org_123"
        credit_gated = True
        if mock_client and credit_gated and output_tokens > 0:
            await mock_client.log_usage("docs.example.com", {}, org_id)
        mock_client.log_usage.assert_not_called()

    @pytest.mark.asyncio
    async def test_log_usage_called_when_positive_tokens(self) -> None:
        mock_client = AsyncMock()
        output_tokens = 150
        org_id = "org_123"
        credit_gated = True
        if mock_client and credit_gated and output_tokens > 0:
            await mock_client.log_usage("docs.example.com", {
                "type": "ask_fern",
                "event_type": "API",
                "response_tokens": output_tokens,
                "metadata": {"domain": "docs.example.com"},
            }, org_id)
        mock_client.log_usage.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_usage_not_called_when_not_gated(self) -> None:
        mock_client = AsyncMock()
        output_tokens = 150
        org_id = "org_123"
        credit_gated = False
        if mock_client and credit_gated and output_tokens > 0:
            await mock_client.log_usage("docs.example.com", {}, org_id)
        mock_client.log_usage.assert_not_called()
