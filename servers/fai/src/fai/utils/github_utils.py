"""Utilities for extracting GitHub repository information from docs domains."""

import re
from typing import TypedDict

import httpx

from fai.dependencies import redis
from fai.settings import (
    LOGGER,
    VARIABLES,
)


class RepoInfo(TypedDict):
    owner: str | None
    repo: str | None


def parse_github_url(github_url: str) -> RepoInfo:
    pieces = github_url.split("github.com/")
    if len(pieces) > 1:
        pieces_after_github = pieces[1]
    else:
        ssh_match = re.search(r"github\.com:(.+)", github_url)
        if ssh_match:
            pieces_after_github = ssh_match.group(1)
        else:
            return {"owner": None, "repo": None}

    parts = pieces_after_github.split("/")[:2]
    if len(parts) < 2:
        owner = parts[0] if parts else None
        return {"owner": owner if owner else None, "repo": None}

    owner = parts[0]
    repo_raw = parts[1]

    repo = re.sub(r"\.git$", "", repo_raw)
    repo = re.sub(r"/$", "", repo)

    return {"owner": owner, "repo": repo}


async def get_repo_from_docs_domain(domain: str) -> str | None:
    cache_key = f"github_repo:{domain}"
    try:
        cached_repo = await redis.get(cache_key)
        if cached_repo:
            LOGGER.info(f"Cache hit for domain {domain}: {cached_repo}")
            return cached_repo if cached_repo != "null" else None
    except Exception as e:
        LOGGER.warning(f"Redis cache read failed for {domain}: {e}")

    try:
        fdr_url = f"{VARIABLES.FDR_REGISTRY_URL}/v2/registry/docs/metadata-for-url"
        headers = {
            "Authorization": f"Bearer {VARIABLES.FERN_TOKEN}",
            "Content-Type": "application/json",
        }
        payload = {"url": domain}

        LOGGER.info(f"Calling FDR API: {fdr_url} with payload: {payload}")

        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.post(fdr_url, headers=headers, json=payload, timeout=10.0)

            LOGGER.info(f"FDR API response status: {response.status_code}")

            if response.status_code != 200:
                LOGGER.warning(
                    f"FDR API returned {response.status_code} for domain {domain}. Response: {response.text}"
                )
                await _cache_repo(cache_key, None)
                return None

            metadata = response.json()
            LOGGER.info(f"FDR API metadata response: {metadata}")

            git_url = metadata.get("gitUrl")

            if not git_url:
                LOGGER.info(f"No GitHub URL found in metadata for domain {domain}")
                await _cache_repo(cache_key, None)
                return None

            repo_info = parse_github_url(git_url)
            owner = repo_info.get("owner")
            repo = repo_info.get("repo")

            # Return owner/repo format if both exist
            if owner and repo:
                owner_repo = f"{owner}/{repo}"
                await _cache_repo(cache_key, owner_repo)
                LOGGER.info(f"Extracted repo '{owner_repo}' from GitHub URL '{git_url}' for domain {domain}")
                return owner_repo
            else:
                LOGGER.warning(f"Could not parse owner/repo from GitHub URL '{git_url}' for domain {domain}")
                await _cache_repo(cache_key, None)
                return None

    except httpx.TimeoutException:
        LOGGER.error(f"Timeout calling FDR API for domain {domain}")
        return None
    except httpx.HTTPError as e:
        LOGGER.error(f"HTTP error calling FDR API for domain {domain}: {e}")
        return None
    except Exception as e:
        LOGGER.error(f"Unexpected error getting repo from domain {domain}: {e}")
        return None


async def _cache_repo(cache_key: str, repo: str | None) -> None:
    try:
        value = repo if repo else "null"
        await redis.set(cache_key, value, ex=300)
    except Exception as e:
        LOGGER.warning(f"Failed to cache repo result: {e}")
