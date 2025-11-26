import os
from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest

from src.exceptions import MetadataValidationError
from src.metadata.fetcher import (
    DocsMetadata,
    fetch_docs_metadata,
    validate_docs_metadata,
)


class TestDocsMetadata:
    def test_create_metadata(self) -> None:
        metadata = DocsMetadata(
            url="buildwithfern.docs.buildwithfern.com",
            org="buildwithfern",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        assert metadata.url == "buildwithfern.docs.buildwithfern.com"
        assert metadata.org == "buildwithfern"
        assert metadata.is_preview is False
        assert metadata.enable_algolia_on_preview is False


class TestFetchDocsMetadata:
    @pytest.mark.asyncio
    async def test_fetch_valid_domain(self) -> None:
        mock_response = MagicMock()
        mock_response.url = "buildwithfern.docs.buildwithfern.com"
        mock_response.org = "buildwithfern"
        mock_response.is_preview_url = False
        mock_response.enable_algolia_on_preview = False

        mock_client = MagicMock()
        mock_client.docs.v_2.read.get_docs_url_metadata = AsyncMock(return_value=mock_response)

        with patch("src.metadata.fetcher.get_fdr_client", return_value=mock_client):
            metadata = await fetch_docs_metadata("buildwithfern.docs.buildwithfern.com")

            assert metadata.url == "buildwithfern.docs.buildwithfern.com"
            assert metadata.org == "buildwithfern"
            assert metadata.is_preview is False
            assert metadata.enable_algolia_on_preview is False

    @pytest.mark.asyncio
    async def test_fetch_preview_domain(self) -> None:
        mock_response = MagicMock()
        mock_response.url = "preview-123.docs.buildwithfern.com"
        mock_response.org = "buildwithfern"
        mock_response.is_preview_url = True
        mock_response.enable_algolia_on_preview = True

        mock_client = MagicMock()
        mock_client.docs.v_2.read.get_docs_url_metadata = AsyncMock(return_value=mock_response)

        with patch("src.metadata.fetcher.get_fdr_client", return_value=mock_client):
            metadata = await fetch_docs_metadata("preview-123.docs.buildwithfern.com")

            assert metadata.is_preview is True
            assert metadata.enable_algolia_on_preview is True

    @pytest.mark.asyncio
    async def test_fetch_invalid_domain_with_brackets(self) -> None:
        with pytest.raises(MetadataValidationError, match="Invalid domain"):
            await fetch_docs_metadata("[domain]")

    @pytest.mark.asyncio
    async def test_fetch_invalid_domain_with_encoded_brackets(self) -> None:
        with pytest.raises(MetadataValidationError, match="Invalid domain"):
            await fetch_docs_metadata("test%5Bdomain%5D")

    @pytest.mark.asyncio
    async def test_fetch_missing_env_vars(self) -> None:
        with (
            patch.dict(os.environ, {}, clear=True),
            patch(
                "src.metadata.fetcher.get_fdr_client",
                side_effect=ValueError("FERN_TOKEN must be set"),
            ),
        ):
            with pytest.raises(MetadataValidationError, match="FERN_TOKEN must be set"):
                await fetch_docs_metadata("test.com")

    @pytest.mark.asyncio
    async def test_fetch_fdr_returns_error(self) -> None:
        mock_client = MagicMock()
        mock_client.docs.v_2.read.get_docs_url_metadata = AsyncMock(side_effect=Exception("Not found"))

        with patch("src.metadata.fetcher.get_fdr_client", return_value=mock_client):
            with pytest.raises(MetadataValidationError, match="Failed to fetch metadata"):
                await fetch_docs_metadata("nonexistent.com")

    @pytest.mark.asyncio
    async def test_fetch_client_exception(self) -> None:
        mock_client = MagicMock()
        mock_client.docs.v_2.read.get_docs_url_metadata = AsyncMock(side_effect=Exception("Connection error"))

        with patch("src.metadata.fetcher.get_fdr_client", return_value=mock_client):
            with pytest.raises(MetadataValidationError, match="Failed to fetch metadata"):
                await fetch_docs_metadata("test.com")


class TestValidateDocsMetadata:
    def test_validate_production_domain(self) -> None:
        metadata = DocsMetadata(
            url="buildwithfern.docs.buildwithfern.com",
            org="buildwithfern",
            is_preview=False,
            enable_algolia_on_preview=False,
        )

        validate_docs_metadata(metadata)

    def test_validate_preview_with_algolia_enabled(self) -> None:
        metadata = DocsMetadata(
            url="preview-123.docs.buildwithfern.com",
            org="buildwithfern",
            is_preview=True,
            enable_algolia_on_preview=True,
        )

        validate_docs_metadata(metadata)

    def test_validate_preview_without_algolia_raises_error(self) -> None:
        metadata = DocsMetadata(
            url="preview-123.docs.buildwithfern.com",
            org="buildwithfern",
            is_preview=True,
            enable_algolia_on_preview=False,
        )

        with pytest.raises(MetadataValidationError, match="Chat is not enabled for preview environments"):
            validate_docs_metadata(metadata)
