"""Tests for URL and branch validation in git_clone module."""

import pytest
from pathlib import Path

from src.git_clone import (
    CloneError,
    URLValidationError,
    validate_github_url,
    validate_branch,
    find_package_root,
)


class TestValidateGithubUrl:
    """Tests for validate_github_url()."""

    def test_accepts_valid_github_urls(self):
        """Valid https://github.com/<owner>/<repo> URLs should pass."""
        validate_github_url("https://github.com/owner/repo")
        validate_github_url("https://github.com/fern-api/fern-platform")
        validate_github_url("https://github.com/my.org/my-repo")
        validate_github_url("https://github.com/owner/repo.git")
        validate_github_url("https://github.com/owner/repo/")

    def test_accepts_valid_gitlab_urls(self):
        """Valid https://gitlab.com/<owner>/<repo> URLs should pass."""
        validate_github_url("https://gitlab.com/owner/repo")
        validate_github_url("https://gitlab.com/my-org/my-project")
        validate_github_url("https://gitlab.com/owner/repo.git")
        validate_github_url("https://gitlab.com/owner/repo/")

    def test_rejects_non_https_protocols(self):
        """Non-HTTPS protocols must be rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("http://github.com/owner/repo")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("git://github.com/owner/repo")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("ftp://github.com/owner/repo")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("file:///etc/passwd")

    def test_rejects_non_allowed_hosts(self):
        """Only github.com and gitlab.com must be accepted as hostname."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://bitbucket.org/owner/repo")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://evil.com/owner/repo")

    def test_rejects_ssrf_targets(self):
        """SSRF targets like IMDS and private IPs must be rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://169.254.169.254/latest/meta-data/")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://10.0.0.1/owner/repo")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://127.0.0.1/owner/repo")

    def test_rejects_embedded_credentials(self):
        """URLs with username or password must be rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://user@github.com/owner/repo")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://user:pass@github.com/owner/repo")

    def test_rejects_invalid_repo_paths(self):
        """URLs without valid /<owner>/<repo> path must be rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://github.com/")
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://github.com/owner")

    def test_rejects_github_and_gitlab_subdomains(self):
        """Subdomains of github.com and gitlab.com must be rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://evil.github.com/owner/repo")
        with pytest.raises(URLValidationError, match="gitlab.com"):
            validate_github_url("https://evil.gitlab.com/owner/repo")

    def test_rejects_empty_string(self):
        """Empty string is rejected."""
        with pytest.raises(URLValidationError, match="non-empty string"):
            validate_github_url("")

    def test_rejects_url_with_query_string(self):
        """URLs with query strings are rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://github.com/org/repo?ref=evil")

    def test_rejects_url_with_fragment(self):
        """URLs with fragments are rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("https://github.com/org/repo#evil")

    def test_rejects_ssh_url(self):
        """SSH URLs are rejected."""
        with pytest.raises(URLValidationError, match="github.com"):
            validate_github_url("git@github.com:org/repo.git")


class TestValidateBranch:
    """Tests for validate_branch()."""

    def test_accepts_valid_branch_names(self):
        """Standard branch names should pass."""
        validate_branch("main")
        validate_branch("feature/my-feature")
        validate_branch("release/1.0.0")
        validate_branch("my_branch.name")

    def test_accepts_none(self):
        """None branch should be accepted (uses default)."""
        validate_branch(None)

    def test_rejects_shell_metacharacters(self):
        """Branch names with shell metacharacters must be rejected."""
        with pytest.raises(CloneError, match="Invalid branch name"):
            validate_branch("main; rm -rf /")
        with pytest.raises(CloneError, match="Invalid branch name"):
            validate_branch("branch$(whoami)")
        with pytest.raises(CloneError, match="Invalid branch name"):
            validate_branch("branch`id`")
        with pytest.raises(CloneError, match="Invalid branch name"):
            validate_branch("branch|cat /etc/passwd")
        with pytest.raises(CloneError, match="Invalid branch name"):
            validate_branch("branch&& echo pwned")

    def test_rejects_empty_string(self):
        """Empty string should be rejected."""
        with pytest.raises(CloneError, match="Invalid branch name"):
            validate_branch("")


class TestFindPackageRootTraversalProtection:
    """Tests for path traversal protection in find_package_root()."""

    def test_rejects_dotdot_traversal(self, tmp_path):
        """Package paths with '..' must be rejected."""
        with pytest.raises(CloneError, match="must not contain path traversal"):
            find_package_root(tmp_path, "../../../etc/passwd")
        with pytest.raises(CloneError, match="must not contain path traversal"):
            find_package_root(tmp_path, "src/../../outside")
        with pytest.raises(CloneError, match="must not contain path traversal"):
            find_package_root(tmp_path, "..")

    def test_rejects_absolute_paths(self, tmp_path):
        """Absolute package paths must be rejected."""
        with pytest.raises(CloneError, match="must not contain path traversal"):
            find_package_root(tmp_path, "/etc/passwd")
        with pytest.raises(CloneError, match="must not contain path traversal"):
            find_package_root(tmp_path, "/tmp/evil")
