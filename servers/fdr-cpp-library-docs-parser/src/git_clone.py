"""Git operations for cloning repositories."""

import shutil
import tempfile
from pathlib import Path

from git import Repo
from git.exc import GitCommandError

from src.exceptions import CloneError


def clone_repo(github_url: str, branch: str | None = None) -> Path:
    """Clone a GitHub repository to a temporary directory."""
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
            f"Failed to clone {github_url}: {str(e.stderr) if e.stderr else 'unknown error'}"
        ) from e


def cleanup_repo(repo_path: Path) -> None:
    """Clean up a cloned repository."""
    shutil.rmtree(repo_path, ignore_errors=True)
