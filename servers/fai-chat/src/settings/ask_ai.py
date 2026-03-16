import logging
from dataclasses import dataclass

from fern_fai_sdk.core.api_error import ApiError

from ..clients.fai_client import get_fai_client
from ..exceptions import AskAICheckError

logger = logging.getLogger(__name__)


@dataclass
class AskAIStatus:
    enabled: bool
    decompose_queries: bool
    is_initially_indexing: bool


async def check_ask_ai_status(domain: str) -> AskAIStatus:
    """Check Ask AI status for a domain.

    Returns:
        AskAIStatus with enabled, decompose_queries, and is_initially_indexing fields.
    """
    try:
        client = get_fai_client()
        settings = await client.settings.get_docs_settings(domain=domain)
        # is_initially_indexing is returned by the FAI API but not yet typed in the SDK;
        # the SDK model uses extra="allow" so it's preserved as an extra field.
        is_initially_indexing: bool = getattr(settings, "is_initially_indexing", False)
        return AskAIStatus(
            enabled=settings.ask_ai_enabled,
            decompose_queries=settings.decompose_queries or False,
            is_initially_indexing=is_initially_indexing,
        )
    except Exception as e:
        logger.exception(f"Error checking Ask AI status for {domain}")
        raise AskAICheckError(f"Failed to check Ask AI status for domain {domain}: {str(e)}")


async def has_ever_had_reindexing_job(domain: str) -> bool:
    """Check if a domain has ever had a reindexing job.

    Calls the FAI reindexing API to look up the latest job for the domain.
    Returns True if a job exists (any status), False if none found (404).
    """
    try:
        client = get_fai_client()
        await client.reindexing.get_reindexing_job_status_by_domain(domain)
        return True
    except ApiError as e:
        if e.status_code == 404:
            return False
        logger.warning(f"Unexpected API error checking reindexing jobs for {domain}: {e}")
        return False
    except Exception as e:
        logger.warning(f"Failed to check reindexing jobs for {domain}: {e}")
        return False


async def is_ask_ai_enabled(domain: str) -> tuple[bool, bool]:
    """Check if Ask AI is enabled for a domain.

    Returns:
        tuple[bool, bool]: (ask_ai_enabled, decompose_queries)
    """
    status = await check_ask_ai_status(domain)
    return status.enabled, status.decompose_queries
