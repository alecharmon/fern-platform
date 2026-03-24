import functools
import logging
import os

from fern_fai_sdk import AsyncFernAI

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def get_fai_client() -> AsyncFernAI:
    fern_token = os.getenv("FERN_TOKEN")
    environment_type = os.getenv("ENVIRONMENT_TYPE", "unknown")

    if not fern_token:
        raise ValueError(
            f"FERN_TOKEN must be set. Environment: {environment_type}. "
            "For dev2 deployments, ensure DEV_FERN_TOKEN is configured in GitHub secrets "
            "and the CDK stack maps it to FERN_TOKEN."
        )

    fai_origin = os.getenv("FAI_ORIGIN")
    if not fai_origin:
        raise ValueError(
            f"FAI_ORIGIN must be set. Environment: {environment_type}. "
            "This should point to the FAI service (e.g. https://fai.buildwithfern.com)."
        )

    logger.info(f"Initialized async FAI client: environment={fai_origin}, env_type={environment_type}")
    return AsyncFernAI(base_url=fai_origin, token=fern_token)
