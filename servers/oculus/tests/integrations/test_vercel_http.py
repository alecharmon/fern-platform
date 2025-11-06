"""Tests for Vercel HTTP integration."""


from oculus.integrations.vercel_http import VercelHTTPIntegration


class TestVercelHTTPIntegration:
    """Tests for VercelHTTPIntegration."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.integration = VercelHTTPIntegration(
            domain="buildwithfern.com",
            model="claude-4-sonnet-20250514",
            vercel_url="https://buildwithfern.com",
        )

    def test_parse_sse_line_valid(self) -> None:
        """Test parsing valid SSE line with numeric prefix."""
        line = '0:{"type":"text-delta","id":"0","delta":"Hello"}'
        result = self.integration._parse_sse_line(line)
        assert result == '{"type":"text-delta","id":"0","delta":"Hello"}'

    def test_parse_sse_line_valid_with_whitespace(self) -> None:
        """Test parsing SSE line with leading/trailing whitespace."""
        line = '1:  {"type":"data-sources","data":[]}  '
        result = self.integration._parse_sse_line(line)
        assert result == '{"type":"data-sources","data":[]}'

    def test_parse_sse_line_multi_digit_prefix(self) -> None:
        """Test parsing SSE line with multi-digit prefix."""
        line = '123:{"type":"tool-call"}'
        result = self.integration._parse_sse_line(line)
        assert result == '{"type":"tool-call"}'

    def test_parse_sse_line_no_colon(self) -> None:
        """Test parsing line without colon returns None."""
        line = "invalid line without colon"
        result = self.integration._parse_sse_line(line)
        assert result is None

    def test_parse_sse_line_non_numeric_prefix(self) -> None:
        """Test parsing line with non-numeric prefix is accepted."""
        line = 'data:{"type":"text-delta"}'
        result = self.integration._parse_sse_line(line)
        assert result == '{"type":"text-delta"}'

    def test_parse_sse_line_empty_data(self) -> None:
        """Test parsing line with empty data after colon returns None."""
        line = "0:"
        result = self.integration._parse_sse_line(line)
        assert result is None

    def test_parse_sse_line_whitespace_only_data(self) -> None:
        """Test parsing line with whitespace-only data returns None."""
        line = "0:   "
        result = self.integration._parse_sse_line(line)
        assert result is None

    def test_parse_sse_line_data_with_colons(self) -> None:
        """Test parsing line where data contains colons."""
        line = '0:{"url":"https://example.com","type":"link"}'
        result = self.integration._parse_sse_line(line)
        assert result == '{"url":"https://example.com","type":"link"}'
