import logging
from dataclasses import dataclass

from fdr_lambda.docs.v_2.read.errors import DomainNotRegisteredError

from ..clients.fdr_client import get_fdr_client

logger = logging.getLogger(__name__)


@dataclass
class DocsMetadata:
    url: str
    org: str
    is_preview: bool
    enable_algolia_on_preview: bool


async def fetch_docs_metadata(domain: str) -> DocsMetadata:
    if "[" in domain or "%5B" in domain:
        raise ValueError(f"Invalid domain: {domain}")

    try:
        client = get_fdr_client()
        response = await client.docs.v_2.read.get_docs_url_metadata(url=domain)

        return DocsMetadata(
            url=response.url,
            org=response.org,
            is_preview=response.is_preview_url,
            enable_algolia_on_preview=response.enable_algolia_on_preview,
        )
    except DomainNotRegisteredError:
        raise ValueError(f"Domain not registered: {domain}")
    except Exception as e:
        logger.exception(f"Error fetching docs metadata for {domain}")
        raise ValueError(f"Failed to fetch metadata for domain {domain}: {str(e)}")


def validate_docs_metadata(metadata: DocsMetadata) -> None:
    if metadata.is_preview and not metadata.enable_algolia_on_preview:
        raise ValueError("Chat is not enabled for preview environments")
