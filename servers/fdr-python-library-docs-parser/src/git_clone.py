"""Git operations for cloning repositories."""

import shutil
import tempfile
from pathlib import Path

from git import Repo
from git.exc import GitCommandError


class CloneError(Exception):
    """Error during git clone operation."""

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


def clone_repo(github_url: str, branch: str | None = None) -> Path:
    """
    Clone a GitHub repository to a temporary directory.

    Args:
        github_url: The GitHub repository URL.
        branch: Optional branch name to checkout. Uses default branch if not specified.

    Returns:
        Path to the cloned repository.

    Raises:
        CloneError: If cloning fails.
    """
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
            f"Failed to clone repository: {github_url}",
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
        explicit_path = repo_path / package_path
        if explicit_path.exists() and _is_python_package(explicit_path):
            return explicit_path
        raise CloneError(
            f"Specified package path not found or not a Python package: {package_path}",
            {"repo_path": str(repo_path), "package_path": package_path},
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
