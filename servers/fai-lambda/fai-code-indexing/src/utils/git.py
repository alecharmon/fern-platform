import logging
import os
import subprocess
from pathlib import Path

logger = logging.getLogger()


def clone_repo_to_domain(domain: str, repo_url: str) -> str:
    """Clone a GitHub repository into EFS under a domain folder.

    Args:
        domain: The domain to associate the repository with (e.g., 'hume.docs.buildwithfern.com')
        repo_url: The GitHub repository URL or 'owner/repo' format

    Returns:
        Path to the cloned repository
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    efs_root = Path(os.environ.get("HOME", "/mnt/efs"))

    domain_folder = efs_root / domain
    domain_folder.mkdir(parents=True, exist_ok=True)

    if repo_url.startswith("https://github.com/"):
        repo_identifier = repo_url.replace("https://github.com/", "").replace(".git", "").rstrip("/")
    else:
        repo_identifier = repo_url.replace(".git", "")

    repo_name = repo_identifier.split("/")[-1]
    repo_path = domain_folder / repo_name

    if repo_path.exists():
        logger.info(f"Repository already exists at {repo_path}, pulling latest changes")
        try:
            subprocess.run(
                ["git", "config", "--global", "--add", "safe.directory", str(repo_path)],
                capture_output=True,
                text=True,
            )
            subprocess.run(
                ["git", "-C", str(repo_path), "fetch", "origin"],
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run(
                ["git", "-C", str(repo_path), "pull", "origin"],
                check=True,
                capture_output=True,
                text=True,
            )
            logger.info(f"Successfully pulled latest changes at {repo_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to pull repository: {e.stderr}")
            raise RuntimeError(f"Failed to pull latest changes: {e.stderr}")
    else:
        clone_url = f"https://x-access-token:{github_token}@github.com/{repo_identifier}.git"

        logger.info(f"Cloning {repo_identifier} into {repo_path} (shallow)")
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", clone_url, str(repo_path)],
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to clone repository: {e.stderr}")
            raise RuntimeError(f"Failed to clone {repo_identifier}: {e.stderr}")

    return str(repo_path)
