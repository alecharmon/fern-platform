"""Tests for FAI HTTP integration."""

from oculus.integrations.fai_http import CITATION_PREFIX


class TestCitationCleaning:
    """Tests for citation prefix cleaning."""

    def test_citation_prefix_constant(self) -> None:
        """Test that the citation prefix constant is defined correctly."""
        assert CITATION_PREFIX == "\nSource: "

    def test_clean_citation_with_prefix(self) -> None:
        """Test cleaning a citation with the prefix."""
        citation = "\nSource: https://buildwithfern.com/learn/docs"
        cleaned = citation.removeprefix(CITATION_PREFIX).strip()
        assert cleaned == "https://buildwithfern.com/learn/docs"

    def test_clean_citation_without_prefix(self) -> None:
        """Test cleaning a citation without the prefix (no-op)."""
        citation = "https://buildwithfern.com/learn/docs"
        cleaned = citation.removeprefix(CITATION_PREFIX).strip()
        assert cleaned == "https://buildwithfern.com/learn/docs"

    def test_clean_citation_prefix_only_at_start(self) -> None:
        """Test that only the prefix at the start is removed, not in the middle."""
        citation = "\nSource: https://example.com\nSource: additional text"
        cleaned = citation.removeprefix(CITATION_PREFIX).strip()
        assert cleaned == "https://example.com\nSource: additional text"
