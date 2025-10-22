import logging
import os
import shutil
import subprocess
import uuid
from pathlib import Path

logger = logging.getLogger()


def setup_session_repo(base_repos_path: str, relative_repo_path: str, sessions_path: str, base_branch: str) -> str:
    full_base_repo_path = Path(base_repos_path) / relative_repo_path

    if not full_base_repo_path.exists():
        logger.info(f"Repository not found, cloning {relative_repo_path}")
        full_base_repo_path.parent.mkdir(parents=True, exist_ok=True)

        github_token = os.environ.get("GITHUB_TOKEN")
        if not github_token:
            raise RuntimeError("GITHUB_TOKEN environment variable not set")

        clone_url = f"https://x-access-token:{github_token}@github.com/{relative_repo_path}.git"

        try:
            subprocess.run(
                ["git", "clone", clone_url, str(full_base_repo_path), "--branch", base_branch],
                check=True,
                capture_output=True,
                text=True
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to clone repository: {e.stderr}")
            raise RuntimeError(f"Failed to clone {relative_repo_path}: {e.stderr}")
    else:
        subprocess.run(["git", "checkout", base_branch], cwd=str(full_base_repo_path), check=True)
        subprocess.run(["git", "pull", "origin", base_branch], cwd=str(full_base_repo_path), check=True)

    session_id = str(uuid.uuid4())
    session_repo_path = Path(sessions_path) / session_id / relative_repo_path
    session_repo_path.parent.mkdir(parents=True, exist_ok=True)

    def ignore_sessions(dir: str, files: list[str]) -> list[str]:
        if "repos" in files and Path(dir) == full_base_repo_path:
            return ["repos"]
        return []

    shutil.copytree(str(full_base_repo_path), str(session_repo_path), ignore=ignore_sessions)

    return str(session_repo_path)


def configure_git_auth(repo_path: str) -> None:
    subprocess.run(["git", "config", "user.name", "fern-support"], cwd=repo_path, check=True)
    subprocess.run(["git", "config", "user.email", "support@buildwithfern.com"], cwd=repo_path, check=True)
