import functools
import logging
import os

from fern_fai_sdk import (
    AsyncFernAI,
    FernAIEnvironment,
)

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def get_fai_client() -> AsyncFernAI:
    fern_token = os.getenv("FERN_TOKEN")

    if not fern_token:
        raise ValueError("FERN_TOKEN must be set")

    fai_origin = os.getenv("FAI_ORIGIN")
    if fai_origin:
        logger.info(f"Initialized async FAI client with custom environment: {fai_origin}")
        return AsyncFernAI(environment=fai_origin, token=fern_token)

    logger.info(f"Initialized async FAI client with environment: {FernAIEnvironment.PRODUCTION.value}")
    return AsyncFernAI(environment=FernAIEnvironment.PRODUCTION, token=fern_token)
