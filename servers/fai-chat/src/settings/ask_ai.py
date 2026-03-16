import logging
from dataclasses import dataclass

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


async def is_ask_ai_enabled(domain: str) -> tuple[bool, bool]:
    """Check if Ask AI is enabled for a domain.

    Returns:
        tuple[bool, bool]: (ask_ai_enabled, decompose_queries)
    """
    status = await check_ask_ai_status(domain)
    return status.enabled, status.decompose_queries
