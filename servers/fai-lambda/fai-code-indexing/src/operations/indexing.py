import logging

from ..models import SetupRepoResult
from ..utils.git import clone_repo_to_domain
from .analysis import analyze_repositories_for_domain

logger = logging.getLogger()


async def setup_repos_for_domain(domain: str, repo_urls: list[str]) -> SetupRepoResult:
    """Set up repositories for a domain by cloning and indexing them.

    Args:
        domain: The domain to associate the repositories with
        repo_urls: List of GitHub repository URLs to clone and index

    Returns:
        Dictionary with setup results
    """
    logger.info(f"Setting up repositories for domain: {domain}, repos: {repo_urls}")

    for repo_url in repo_urls:
        await clone_repo_to_domain(domain=domain, repo_url=repo_url)

    analysis_result = await analyze_repositories_for_domain(domain=domain)
    logger.info(f"Analysis completed for domain {domain} repositories")

    return SetupRepoResult(
        domain=domain,
        session_id=analysis_result.session_id,
        status=analysis_result.status,
        error=analysis_result.error,
    )
