from fai.utils.github_utils import parse_github_url


class TestParseGithubUrl:
    """Test the parse_github_url function."""

    def test_parse_https_url(self) -> None:
        """Test parsing a standard HTTPS GitHub URL."""
        url = "https://github.com/fern-api/fern-platform"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"

    def test_parse_https_url_with_git_suffix(self) -> None:
        """Test parsing HTTPS URL with .git suffix."""
        url = "https://github.com/fern-api/fern-platform.git"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"

    def test_parse_https_url_with_trailing_slash(self) -> None:
        """Test parsing HTTPS URL with trailing slash."""
        url = "https://github.com/fern-api/fern-platform/"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"

    def test_parse_ssh_url_with_git_prefix(self) -> None:
        """Test parsing SSH URL with git@ prefix."""
        url = "git@github.com:fern-api/fern-platform.git"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"

    def test_parse_ssh_url_without_git_prefix(self) -> None:
        """Test parsing SSH URL without git@ prefix."""
        url = "github.com:fern-api/fern-platform"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"

    def test_parse_http_url(self) -> None:
        """Test parsing HTTP URL (not HTTPS)."""
        url = "http://github.com/fern-api/fern-platform"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"

    def test_parse_url_with_additional_path_segments(self) -> None:
        """Test parsing URL with additional path segments (should ignore them)."""
        url = "https://github.com/fern-api/fern-platform/tree/main/docs"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"

    def test_parse_invalid_url_no_github(self) -> None:
        """Test parsing URL that doesn't contain github.com."""
        url = "https://gitlab.com/some-user/some-repo"
        result = parse_github_url(url)
        assert result["owner"] is None
        assert result["repo"] is None

    def test_parse_incomplete_url_only_owner(self) -> None:
        """Test parsing URL with only owner, no repo."""
        url = "https://github.com/fern-api"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] is None

    def test_parse_invalid_url_no_owner_or_repo(self) -> None:
        """Test parsing URL with no owner or repo."""
        url = "https://github.com/"
        result = parse_github_url(url)
        assert result["owner"] is None
        assert result["repo"] is None

    def test_parse_empty_string(self) -> None:
        """Test parsing empty string."""
        url = ""
        result = parse_github_url(url)
        assert result["owner"] is None
        assert result["repo"] is None

    def test_parse_url_with_git_suffix_and_trailing_slash(self) -> None:
        """Test parsing URL with both .git suffix and trailing slash."""
        url = "https://github.com/fern-api/fern-platform.git/"
        result = parse_github_url(url)
        assert result["owner"] == "fern-api"
        assert result["repo"] == "fern-platform"
