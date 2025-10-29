import logging
import os
from pathlib import Path

logger = logging.getLogger()


def setup_persistent_claude_storage(repo_path: str) -> None:
    """Setup persistent Claude storage by symlinking .claude directory.

    Args:
        repo_path: Path to the repository
    """
    repo_claude_dir = Path(repo_path) / ".claude"
    persistent_claude_dir = Path(os.environ.get("HOME", "/tmp")) / ".claude"

    persistent_claude_dir.mkdir(parents=True, exist_ok=True)

    if repo_claude_dir.exists() or repo_claude_dir.is_symlink():
        if repo_claude_dir.is_symlink():
            repo_claude_dir.unlink()
        elif repo_claude_dir.is_dir():
            import shutil

            shutil.rmtree(repo_claude_dir)
        else:
            repo_claude_dir.unlink()

    repo_claude_dir.symlink_to(persistent_claude_dir)
    logger.info(f"Created symlink: {repo_claude_dir} -> {persistent_claude_dir}")
