import os
from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest

from src.settings.ask_ai import is_ask_ai_enabled


class TestIsAskAiEnabled:
    @pytest.mark.asyncio
    async def test_ask_ai_enabled(self) -> None:
        mock_settings = MagicMock()
        mock_settings.ask_ai_enabled = True

        mock_client = MagicMock()
        mock_client.settings.get_docs_settings = AsyncMock(return_value=mock_settings)

        with patch("src.settings.ask_ai.get_fai_client", return_value=mock_client):
            result = await is_ask_ai_enabled("buildwithfern.docs.buildwithfern.com")

            assert result is True
            mock_client.settings.get_docs_settings.assert_called_once_with(
                domain="buildwithfern.docs.buildwithfern.com"
            )

    @pytest.mark.asyncio
    async def test_ask_ai_disabled(self) -> None:
        mock_settings = MagicMock()
        mock_settings.ask_ai_enabled = False

        mock_client = MagicMock()
        mock_client.settings.get_docs_settings = AsyncMock(return_value=mock_settings)

        with patch("src.settings.ask_ai.get_fai_client", return_value=mock_client):
            result = await is_ask_ai_enabled("test.docs.buildwithfern.com")

            assert result is False

    @pytest.mark.asyncio
    async def test_missing_env_vars(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("src.settings.ask_ai.get_fai_client", side_effect=ValueError("FERN_TOKEN must be set")),
        ):
            with pytest.raises(ValueError, match="FERN_TOKEN must be set"):
                await is_ask_ai_enabled("test.com")

    @pytest.mark.asyncio
    async def test_with_fern_token_only(self) -> None:
        mock_settings = MagicMock()
        mock_settings.ask_ai_enabled = True

        mock_client = MagicMock()
        mock_client.settings.get_docs_settings = AsyncMock(return_value=mock_settings)

        with (
            patch.dict(os.environ, {"FERN_TOKEN": "test-token"}, clear=True),
            patch("src.settings.ask_ai.get_fai_client", return_value=mock_client),
        ):
            result = await is_ask_ai_enabled("test.com")
            assert result is True

    @pytest.mark.asyncio
    async def test_missing_fern_token_only(self) -> None:
        with (
            patch.dict(os.environ, {"ENVIRONMENT_TYPE": "DEV"}, clear=True),
            patch("src.settings.ask_ai.get_fai_client", side_effect=ValueError("FERN_TOKEN must be set")),
        ):
            with pytest.raises(ValueError, match="FERN_TOKEN must be set"):
                await is_ask_ai_enabled("test.com")

    @pytest.mark.asyncio
    async def test_client_exception(self) -> None:
        mock_client = MagicMock()
        mock_client.settings.get_docs_settings = AsyncMock(side_effect=Exception("Connection error"))

        with patch("src.settings.ask_ai.get_fai_client", return_value=mock_client):
            with pytest.raises(ValueError, match="Failed to check Ask AI status"):
                await is_ask_ai_enabled("test.com")
