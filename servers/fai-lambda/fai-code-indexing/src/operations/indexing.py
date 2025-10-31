import logging

from ..models import SetupRepoResult
from ..utils.git import clone_repo_to_domain
from .analysis import analyze_repositories_for_domain

logger = logging.getLogger()


async def setup_repo_for_domain(domain: str, repo_url: str) -> SetupRepoResult:
    """Set up a repository for a domain by cloning and indexing it.

    Args:
        domain: The domain to associate the repository with
        repo_url: The GitHub repository URL to clone and index

    Returns:
        Dictionary with setup results
    """
    logger.info(f"Setting up repository for domain: {domain}, repo: {repo_url}")

    repo_path = clone_repo_to_domain(domain=domain, repo_url=repo_url)
    logger.info(f"Repository cloned to: {repo_path}")

    analysis_result = await analyze_repositories_for_domain(domain=domain)
    logger.info(f"Analysis completed for domain {domain} repositories")

    return SetupRepoResult(
        domain=domain,
        session_id=analysis_result.session_id,
        status=analysis_result.status,
        error=analysis_result.error,
    )
