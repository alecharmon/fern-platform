import asyncio
import logging
import os
from pathlib import Path

from ..models import (
    IndexMarkdownResult,
    MarkdownFileDocument,
)
from ..utils.fai_client import get_fai_client
from ..utils.markdown import chunk_markdown_file

logger = logging.getLogger()


async def _get_github_url_from_repo(repo_path: Path) -> str | None:
    """Extract GitHub URL from git remote origin."""
    try:
        process = await asyncio.create_subprocess_exec(
            "git",
            "-C",
            str(repo_path),
            "config",
            "--get",
            "remote.origin.url",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()

        if process.returncode == 0:
            url = stdout.decode().strip()
            if url.startswith("https://"):
                url = url.replace(".git", "")
                if "@github.com/" in url:
                    url = "https://github.com/" + url.split("@github.com/")[1]
                return url
            elif url.startswith("git@github.com:"):
                return "https://github.com/" + url.replace("git@github.com:", "").replace(".git", "")
    except Exception as e:
        logger.warning(f"Failed to get GitHub URL for {repo_path}: {e}")

    return None


async def index_markdown_for_domain(domain: str, repo_urls: list[str] | None = None) -> IndexMarkdownResult:
    """Index markdown for a domain.

    Args:
        domain: The domain to index markdown for
        repo_urls: Optional list of specific repo URLs to index (e.g., ["owner/repo"]). If None, indexes all repos.

    Returns:
        Dictionary with indexing results
    """
    logger.info(f"Indexing markdown for domain: {domain}")

    efs_root = Path(os.environ.get("HOME", "/mnt/efs"))
    domain_folder = efs_root / domain

    if not domain_folder.exists():
        error_msg = f"Domain folder does not exist: {domain_folder}"
        logger.error(error_msg)
        return IndexMarkdownResult(
            domain=domain,
            status="error",
            error=error_msg,
        )

    allowed_repo_names = {url.split("/")[-1] for url in repo_urls} if repo_urls else None
    if allowed_repo_names:
        logger.info(f"Filtering to specific repos: {allowed_repo_names}")

    markdown_files_by_repo: dict[str, list[MarkdownFileDocument]] = {}

    for repo_folder in domain_folder.iterdir():
        if not repo_folder.is_dir():
            continue

        if allowed_repo_names and repo_folder.name not in allowed_repo_names:
            logger.debug(f"Skipping repo {repo_folder.name} (not in allowed list)")
            continue

        repo_name = repo_folder.name
        markdown_file_paths = list[Path](repo_folder.glob("**/*.md"))

        if markdown_file_paths:
            github_base_url = await _get_github_url_from_repo(repo_folder)

            markdown_chunks_all: list[MarkdownFileDocument] = []

            reference_files = [f for f in markdown_file_paths if f.name.lower() == "reference.md"]
            regular_files = [f for f in markdown_file_paths if f.name.lower() != "reference.md"]

            for file_path in regular_files:
                relative_path = file_path.relative_to(repo_folder)

                github_url = None
                if github_base_url:
                    github_url = f"{github_base_url}/blob/main/{relative_path}"

                repo_name_for_file = repo_name
                if github_base_url and len(github_base_url.split("/")) > 4:
                    repo_name_for_file = github_base_url.split("/")[4]

                markdown_chunks = await chunk_markdown_file(
                    file_path=file_path,
                    url=github_url,
                    github_url=github_url,
                    global_keywords=[repo_name_for_file],
                    repo_name=repo_name_for_file,
                )

                markdown_chunks_all.extend(markdown_chunks)
                logger.info(f"Chunked {file_path.name}: {len(markdown_chunks)} chunks")

            markdown_files_by_repo[repo_name] = markdown_chunks_all
            logger.info(
                f"Found {len(regular_files)} regular + {len(reference_files)} reference "
                f"markdown files with {len(markdown_chunks_all)} total chunks in repo: {repo_name}"
            )

    logger.info(f"Total repos with markdown: {len(markdown_files_by_repo)}")

    fai_client = get_fai_client()
    total_indexed = 0

    for repo_name, chunks in markdown_files_by_repo.items():
        logger.info(f"Indexing {len(chunks)} chunks for repo {repo_name} to FAI...")

        batch_requests = []
        for chunk_doc in chunks:
            batch_requests.append(
                {
                    "document": chunk_doc["document"],
                    "chunk": chunk_doc["chunk"],
                    "title": chunk_doc["title"],
                    "url": chunk_doc["url"],
                    "keywords": chunk_doc["keywords"],
                }
            )

        try:
            response = fai_client.code.batch_create_code_records(domain=domain, request=batch_requests)
            total_indexed += len(response)
            logger.info(f"Successfully indexed {len(response)} code chunks for repo {repo_name}")

        except Exception as e:
            logger.error(f"Failed to batch index chunks for repo {repo_name}: {e}")

        logger.info(f"Completed indexing {len(chunks)} chunks for repo {repo_name}")

    logger.info(f"Successfully indexed {total_indexed} documents across {len(markdown_files_by_repo)} repos")

    return IndexMarkdownResult(
        domain=domain,
        status="success",
        error=None,
    )
