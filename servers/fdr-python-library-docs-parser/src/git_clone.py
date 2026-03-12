"""Git operations for cloning repositories."""

import logging
import re
import shutil
import tempfile
from pathlib import Path

from git import Repo
from git.exc import GitCommandError

logger = logging.getLogger(__name__)

# Only allow HTTPS GitHub/GitLab URLs matching https://(github|gitlab).com/<owner>/<repo>
# with optional .git suffix and optional trailing slash.
_ALLOWED_REPO_URL_PATTERN = re.compile(
    r"^https://(?:github\.com|gitlab\.com)/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$"
)

_SAFE_BRANCH_RE = re.compile(r"^[a-zA-Z0-9._/-]+$")


class URLValidationError(Exception):
    """Git repository URL failed validation.

    Currently only GitHub and GitLab HTTPS URLs are supported.
    """

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class CloneError(Exception):
    """Error during git clone operation."""

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


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
    """
    Clone a GitHub repository to a temporary directory.

    The URL is validated before cloning to prevent SSRF and arbitrary
    git-clone attacks (``file://``, private IPs, metadata endpoints, etc.).

    Args:
        github_url: The GitHub repository URL.
        branch: Optional branch name to checkout. Uses default branch if not specified.

    Returns:
        Path to the cloned repository.

    Raises:
        URLValidationError: If the URL is not a valid GitHub HTTPS URL.
        CloneError: If cloning fails.
    """
    # Defense-in-depth: validate URL even though the API layer should have
    # already validated it before invoking this Lambda.
    validate_github_url(github_url)
    validate_branch(branch)

    temp_dir = tempfile.mkdtemp(prefix="libdocs-")

    try:
        clone_kwargs = {
            "depth": 1,  # Shallow clone for speed
            "single_branch": True,
        }

        if branch:
            clone_kwargs["branch"] = branch

        Repo.clone_from(github_url, temp_dir, **clone_kwargs)
        return Path(temp_dir)

    except GitCommandError as e:
        # Clean up on failure
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise CloneError(
            "Failed to clone repository",
            {"stderr": str(e.stderr) if e.stderr else None, "branch": branch},
        ) from e


def find_package_root(repo_path: Path, package_path: str | None = None) -> Path:
    """
    Find the Python package root in a cloned repository.

    Args:
        repo_path: Path to the cloned repository.
        package_path: Optional explicit path to the package within the repo.

    Returns:
        Path to the Python package root directory.

    Raises:
        CloneError: If no package can be found.
    """
    if package_path:
        # Prevent path traversal
        if ".." in package_path or package_path.startswith("/"):
            raise CloneError(
                "Invalid package path: must not contain path traversal sequences",
            )
        explicit_path = (repo_path / package_path).resolve()
        # Ensure resolved path stays inside the repo.
        # Use Path.relative_to() instead of string prefix matching to avoid
        # false positives when repo_path is a prefix of another directory
        # (e.g. /tmp/repo vs /tmp/repo-other).
        try:
            explicit_path.relative_to(repo_path.resolve())
        except ValueError:
            raise CloneError(
                "Invalid package path: resolves outside repository",
            )
        if explicit_path.exists() and _is_python_package(explicit_path):
            return explicit_path
        raise CloneError(
            "Specified package path not found or not a Python package",
            {"package_path": package_path},
        )

    # Auto-detect: try common layouts

    # 1. src/ layout (PEP 517 style)
    src_path = repo_path / "src"
    if src_path.exists():
        for child in sorted(src_path.iterdir()):
            if child.is_dir() and _is_python_package(child):
                return child

    # 2. Top-level package (same name as repo or common names)
    skip_dirs = {
        "tests",
        "test",
        "docs",
        "doc",
        "examples",
        "example",
        "scripts",
        "tools",
        "benchmarks",
        ".git",
        ".github",
        "__pycache__",
        ".venv",
        "venv",
        "env",
    }

    for child in sorted(repo_path.iterdir()):
        if child.is_dir() and child.name not in skip_dirs and _is_python_package(child):
            return child

    # 3. The repo itself might be a package
    if _is_python_package(repo_path):
        return repo_path

    raise CloneError(
        "Could not find Python package in repository",
        {"repo_path": str(repo_path), "contents": [p.name for p in repo_path.iterdir()]},
    )


def _is_python_package(path: Path) -> bool:
    """Check if a directory is a Python package (has __init__.py)."""
    return path.is_dir() and (path / "__init__.py").exists()


def cleanup_repo(repo_path: Path) -> None:
    """Clean up a cloned repository."""
    shutil.rmtree(repo_path, ignore_errors=True)
