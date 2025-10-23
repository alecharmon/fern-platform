import logging
import os
import subprocess
import uuid
from pathlib import Path

logger = logging.getLogger()


def setup_session_repo(relative_repo_path: str, base_branch: str) -> str:
    """Clone repository directly into /tmp for this Lambda invocation."""
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        raise RuntimeError("GITHUB_TOKEN environment variable not set")

    session_id = str(uuid.uuid4())
    repo_path = Path("/tmp") / session_id / relative_repo_path
    repo_path.parent.mkdir(parents=True, exist_ok=True)

    clone_url = f"https://x-access-token:{github_token}@github.com/{relative_repo_path}.git"

    logger.info(f"Cloning {relative_repo_path} into {repo_path}")
    try:
        subprocess.run(
            ["git", "clone", clone_url, str(repo_path), "--branch", base_branch, "--depth", "1"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to clone repository: {e.stderr}")
        raise RuntimeError(f"Failed to clone {relative_repo_path}: {e.stderr}")

    return str(repo_path)


def configure_git_auth(repo_path: str) -> None:
    subprocess.run(["git", "config", "user.name", "fern-support"], cwd=repo_path, check=True)
    subprocess.run(["git", "config", "user.email", "support@buildwithfern.com"], cwd=repo_path, check=True)
