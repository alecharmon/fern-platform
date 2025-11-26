import logging

from ..clients.fai_client import get_fai_client
from ..exceptions import AskAICheckError

logger = logging.getLogger(__name__)


async def is_ask_ai_enabled(domain: str) -> bool:
    try:
        client = get_fai_client()
        settings = await client.settings.get_docs_settings(domain=domain)
        return settings.ask_ai_enabled
    except Exception as e:
        logger.exception(f"Error checking Ask AI status for {domain}")
        raise AskAICheckError(f"Failed to check Ask AI status for domain {domain}: {str(e)}")
