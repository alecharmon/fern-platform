import logging
import os
import subprocess
from pathlib import Path

logger = logging.getLogger()


def setup_editing_repo(
    repository: str,
    base_branch: str,
    working_branch: str,
    is_new_session: bool,
    editing_id: str,
) -> str:
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        raise RuntimeError("GITHUB_TOKEN environment variable not set")

    # Use editing_id for deterministic path across Lambda invocations
    repo_path = Path("/tmp") / f"editing-{editing_id}" / repository
    repo_path.parent.mkdir(parents=True, exist_ok=True)

    clone_url = f"https://x-access-token:{github_token}@github.com/{repository}.git"

    logger.info(f"Cloning {repository} into {repo_path}")
    try:
        subprocess.run(
            ["git", "clone", clone_url, str(repo_path)],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to clone repository: {e.stderr}")
        raise RuntimeError(f"Failed to clone {repository}: {e.stderr}")

    configure_git_auth(str(repo_path))

    if is_new_session:
        logger.info(f"Creating new branch '{working_branch}' from '{base_branch}'")
        try:
            subprocess.run(
                ["git", "checkout", "-b", working_branch, f"origin/{base_branch}"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create branch: {e.stderr}")
            raise RuntimeError(f"Failed to create branch {working_branch}: {e.stderr}")
    else:
        logger.info(f"Checking out existing branch '{working_branch}'")
        try:
            subprocess.run(
                ["git", "checkout", working_branch],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to checkout branch: {e.stderr}")
            raise RuntimeError(f"Failed to checkout branch {working_branch}: {e.stderr}")

    return str(repo_path)


def configure_git_auth(repo_path: str) -> None:
    subprocess.run(["git", "config", "user.name", "fern-support"], cwd=repo_path, check=True)
    subprocess.run(["git", "config", "user.email", "support@buildwithfern.com"], cwd=repo_path, check=True)
