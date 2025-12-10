"""Tests for FAI-Chat HTTP integration."""

from oculus.integrations.faichat_http import FAIChatHTTPIntegration


class TestFAIChatHTTPIntegration:
    """Tests for FAIChatHTTPIntegration."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.integration = FAIChatHTTPIntegration(
            domain="buildwithfern.com",
            model="claude-4-sonnet-20250514",
            faichat_url="https://fai-chat.buildwithfern.com",
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


class TestFAIChatHTTPSSLVerification:
    """Tests for SSL verification behavior."""

    def test_ssl_verify_default_buildwithfern_domain(self) -> None:
        """Test SSL verification enabled for buildwithfern.com URLs."""
        integration = FAIChatHTTPIntegration(
            domain="example.com",
            faichat_url="https://fai-chat.buildwithfern.com",
        )
        assert integration.ssl_verify is True

    def test_ssl_verify_default_dev_domain(self) -> None:
        """Test SSL verification enabled for dev buildwithfern.com URLs."""
        integration = FAIChatHTTPIntegration(
            domain="example.com",
            faichat_url="https://fai-chat-dev2.buildwithfern.com",
        )
        assert integration.ssl_verify is True

    def test_ssl_verify_default_preview_domain(self) -> None:
        """Test SSL verification disabled for non-buildwithfern.com URLs."""
        integration = FAIChatHTTPIntegration(
            domain="example.com",
            faichat_url="https://preview-abc123.vercel.app",
        )
        assert integration.ssl_verify is False

    def test_ssl_verify_explicit_override_true(self) -> None:
        """Test explicit ssl_verify=True overrides auto-detection."""
        integration = FAIChatHTTPIntegration(
            domain="example.com",
            faichat_url="https://preview-abc123.vercel.app",
            ssl_verify=True,
        )
        assert integration.ssl_verify is True

    def test_ssl_verify_explicit_override_false(self) -> None:
        """Test explicit ssl_verify=False overrides auto-detection."""
        integration = FAIChatHTTPIntegration(
            domain="example.com",
            faichat_url="https://fai-chat.buildwithfern.com",
            ssl_verify=False,
        )
        assert integration.ssl_verify is False
