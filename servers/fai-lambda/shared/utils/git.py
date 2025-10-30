import logging
import os
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger()


def clone_repo(repository: str, session_id: str, session_type: str = "session") -> str:
    """Clone a GitHub repository into /tmp.

    Args:
        repository: GitHub repository in format 'owner/repo'
        session_id: Unique identifier for this session
        session_type: Type of session (e.g., 'editing', 'indexing')

    Returns:
        Path to the cloned repository
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        raise RuntimeError("GITHUB_TOKEN environment variable not set")

    repo_path = Path("/tmp") / f"{session_type}-{session_id}" / repository
    repo_path.parent.mkdir(parents=True, exist_ok=True)

    if repo_path.exists():
        logger.info(f"Directory {repo_path} already exists, removing it (Lambda container reuse)")
        try:
            shutil.rmtree(repo_path)
            logger.info(f"Successfully removed existing directory at {repo_path}")
        except Exception as e:
            logger.error(f"Failed to remove existing directory at {repo_path}: {e}")
            raise RuntimeError(f"Failed to clean up existing directory: {e}")

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

    return str(repo_path)


def configure_git_auth(repo_path: str) -> None:
    """Configure git user for the repository."""
    subprocess.run(["git", "config", "user.name", "fern-support"], cwd=repo_path, check=True)
    subprocess.run(["git", "config", "user.email", "support@buildwithfern.com"], cwd=repo_path, check=True)


def checkout_or_create_branch(
    repo_path: str,
    branch_name: str,
    base_branch: str | None = None,
    create_new: bool = False,
) -> None:
    """Checkout an existing branch or create a new one.

    Args:
        repo_path: Path to the git repository
        branch_name: Name of the branch to checkout/create
        base_branch: Base branch to create from (used if branch doesn't exist)
        create_new: Whether to create a new branch (if True, will error if branch exists)
    """
    if create_new:
        if not base_branch:
            raise ValueError("base_branch is required when create_new is True")
        logger.info(f"Creating new branch '{branch_name}' from '{base_branch}'")
        try:
            subprocess.run(
                ["git", "checkout", "-b", branch_name, f"origin/{base_branch}"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create branch: {e.stderr}")
            raise RuntimeError(f"Failed to create branch {branch_name}: {e.stderr}")
    else:
        logger.info(f"Checking out branch '{branch_name}'")

        result = subprocess.run(
            ["git", "checkout", branch_name],
            cwd=repo_path,
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            logger.info(f"Successfully checked out local branch '{branch_name}'")
            return

        logger.info(f"Local branch not found, trying to fetch from origin")
        fetch_result = subprocess.run(
            ["git", "fetch", "origin", f"{branch_name}:{branch_name}"],
            cwd=repo_path,
            capture_output=True,
            text=True,
        )

        if fetch_result.returncode == 0:
            checkout_result = subprocess.run(
                ["git", "checkout", branch_name],
                cwd=repo_path,
                capture_output=True,
                text=True,
            )
            if checkout_result.returncode == 0:
                logger.info(f"Successfully checked out remote branch '{branch_name}'")
                return

        if not base_branch:
            logger.error(f"Branch '{branch_name}' not found and no base_branch provided")
            raise RuntimeError(
                f"Branch {branch_name} does not exist and base_branch is required to create it. "
                f"Local error: {result.stderr}. Fetch error: {fetch_result.stderr}"
            )

        logger.info(
            f"Branch '{branch_name}' does not exist anywhere, creating from '{base_branch}' "
            "(likely recovering from interrupted session)"
        )
        try:
            subprocess.run(
                ["git", "checkout", "-b", branch_name, f"origin/{base_branch}"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info(f"Successfully created branch '{branch_name}' from '{base_branch}'")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create branch from base: {e.stderr}")
            raise RuntimeError(f"Failed to create branch {branch_name} from {base_branch}: {e.stderr}")
