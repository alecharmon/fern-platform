"""Git operations for cloning repositories."""

import logging
import re
import shutil
import tempfile
from pathlib import Path

from git import Repo
from git.exc import GitCommandError

from src.exceptions import CloneError, URLValidationError

logger = logging.getLogger(__name__)

# Only allow HTTPS GitHub/GitLab URLs matching https://(github|gitlab).com/<owner>/<repo>
# with optional .git suffix and optional trailing slash.
_ALLOWED_REPO_URL_PATTERN = re.compile(
    r"^https://(?:github\.com|gitlab\.com)/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$"
)

_SAFE_BRANCH_RE = re.compile(r"^[a-zA-Z0-9._/-]+$")


def validate_github_url(url: str) -> None:
    """Validate that a URL is an allowed GitHub or GitLab HTTPS URL.

    Rejects non-GitHub/GitLab hosts, non-HTTPS protocols, private IP ranges,
    metadata endpoints, ``file://`` URIs, and any URL that does not match
    the pattern ``https://(github|gitlab).com/<owner>/<repo>``.

    Raises:
        URLValidationError: If the URL fails validation.
    """
    if not isinstance(url, str) or not url.strip():
        logger.warning("URL validation rejected empty/non-string value: %r", url)
        raise URLValidationError(
            "githubUrl must be a non-empty string",
            {"url": url},
        )

    if not _ALLOWED_REPO_URL_PATTERN.match(url):
        logger.warning("URL validation rejected disallowed URL: %s", url)
        raise URLValidationError(
            "githubUrl must match https://github.com/<owner>/<repo> or https://gitlab.com/<owner>/<repo>",
            {"url": url},
        )


def validate_branch(branch: str | None) -> None:
    """Validate that a branch name contains only safe characters."""
    if branch is not None and not _SAFE_BRANCH_RE.match(branch):
        raise CloneError("Invalid branch name")


def clone_repo(github_url: str, branch: str | None = None) -> Path:
    """Clone a GitHub repository to a temporary directory.

    The URL is validated before cloning to prevent SSRF and arbitrary
    git-clone attacks (``file://``, private IPs, metadata endpoints, etc.).

    Raises:
        URLValidationError: If the URL is not a valid GitHub HTTPS URL.
        CloneError: If the git clone operation fails.
    """
    # Defense-in-depth: validate URL even though the API layer should have
    # already validated it before invoking this Lambda.
    validate_github_url(github_url)
    validate_branch(branch)

    temp_dir = tempfile.mkdtemp(prefix="libdocs-cpp-")

    try:
        clone_kwargs = {
            "depth": 1,
            "single_branch": True,
        }

        if branch:
            clone_kwargs["branch"] = branch

        Repo.clone_from(github_url, temp_dir, **clone_kwargs)
        return Path(temp_dir)

    except GitCommandError as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise CloneError(
            "Failed to clone repository",
            {"stderr": str(e.stderr) if e.stderr else None, "branch": branch},
        ) from e


def cleanup_repo(repo_path: Path) -> None:
    """Clean up a cloned repository."""
    shutil.rmtree(repo_path, ignore_errors=True)
