import asyncio
import logging
import os
from pathlib import Path

logger = logging.getLogger()


async def clone_repo_to_domain(domain: str, repo_url: str) -> str:
    """Clone a GitHub repository into EFS under a domain folder.

    Args:
        domain: The domain to associate the repository with (e.g., 'hume.docs.buildwithfern.com')
        repo_url: The GitHub repository URL or 'owner/repo' format

    Returns:
        Path to the cloned repository
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    efs_root = Path(os.environ.get("HOME", "/mnt/efs"))

    # Use /tmp for git config to avoid EFS lock contention
    git_env = os.environ.copy()
    git_env["GIT_CONFIG_GLOBAL"] = "/tmp/.gitconfig"

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
            config_process = await asyncio.create_subprocess_exec(
                "git",
                "config",
                "--global",
                "safe.directory",
                "*",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=git_env,
            )

            _, stderr = await config_process.communicate()
            if config_process.returncode != 0:
                logger.warning(f"Failed to set safe.directory: {stderr.decode()}")

            process = await asyncio.create_subprocess_exec(
                "git",
                "-C",
                str(repo_path),
                "fetch",
                "origin",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=git_env,
            )
            _, stderr = await process.communicate()
            if process.returncode != 0:
                raise RuntimeError(f"Failed to fetch: {stderr.decode()}")

            process = await asyncio.create_subprocess_exec(
                "git",
                "-C",
                str(repo_path),
                "pull",
                "origin",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=git_env,
            )
            _, stderr = await process.communicate()
            if process.returncode != 0:
                raise RuntimeError(f"Failed to pull: {stderr.decode()}")

            logger.info(f"Successfully pulled latest changes at {repo_path}")
        except Exception as e:
            logger.error(f"Failed to pull repository: {e}")
            raise RuntimeError(f"Failed to pull latest changes: {e}")
    else:
        clone_url = f"https://x-access-token:{github_token}@github.com/{repo_identifier}.git"

        logger.info(f"Cloning {repo_identifier} into {repo_path} (shallow)")
        try:
            process = await asyncio.create_subprocess_exec(
                "git",
                "clone",
                "--depth",
                "1",
                clone_url,
                str(repo_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=git_env,
            )
            _, stderr = await process.communicate()
            if process.returncode != 0:
                raise RuntimeError(f"Failed to clone {repo_identifier}: {stderr.decode()}")
            logger.info(f"Repository cloned to: {repo_path}")
        except Exception as e:
            logger.error(f"Failed to clone repository: {e}")
            raise RuntimeError(f"Failed to clone {repo_identifier}: {e}")

    return str(repo_path)
