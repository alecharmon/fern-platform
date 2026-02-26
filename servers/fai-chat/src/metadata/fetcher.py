import logging
import os
from dataclasses import dataclass

from fdr_lambda.docs.v_2.read.errors import DomainNotRegisteredError

from ..clients.fdr_client import get_fdr_client
from ..exceptions import MetadataValidationError

logger = logging.getLogger(__name__)


@dataclass
class DocsMetadata:
    url: str
    org: str
    is_preview: bool
    enable_algolia_on_preview: bool


def _extract_hostname(domain: str) -> str:
    from urllib.parse import urlparse

    if "/" not in domain:
        return domain
    url = domain if domain.startswith(("http://", "https://")) else f"https://{domain}"
    return urlparse(url).hostname or domain


async def fetch_docs_metadata(domain: str) -> DocsMetadata:
    if "[" in domain or "%5B" in domain:
        raise MetadataValidationError(f"Invalid domain: {domain}")

    hostname = _extract_hostname(domain)
    logger.info(f"Fetching docs metadata: domain={domain}, hostname={hostname}")

    try:
        client = get_fdr_client()
        response = await client.docs.v_2.read.get_docs_url_metadata(url=hostname)

        return DocsMetadata(
            url=response.url,
            org=response.org,
            is_preview=response.is_preview_url,
            enable_algolia_on_preview=response.enable_algolia_on_preview,
        )
    except DomainNotRegisteredError:
        fdr_origin = os.getenv("FDR_LAMBDA_ORIGIN", "default (production)")
        raise MetadataValidationError(
            f"Domain not registered: {domain}. "
            f"FDR environment: {fdr_origin}. "
            "Verify the domain exists in the target FDR environment and "
            "that FDR_LAMBDA_ORIGIN points to the correct registry."
        )
    except Exception as e:
        fdr_origin = os.getenv("FDR_LAMBDA_ORIGIN", "default (production)")
        logger.exception(f"Error fetching docs metadata for {domain} (FDR: {fdr_origin})")
        raise MetadataValidationError(f"Failed to fetch metadata for domain {domain}: {str(e)}")


def validate_docs_metadata(metadata: DocsMetadata) -> None:
    if metadata.is_preview and not metadata.enable_algolia_on_preview:
        raise MetadataValidationError("Chat is not enabled for preview environments")
