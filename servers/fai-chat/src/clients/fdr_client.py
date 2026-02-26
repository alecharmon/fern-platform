import functools
import logging
import os

from fdr_lambda import (
    AsyncFdrLambdaClient,
    FdrLambdaClientEnvironment,
)

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def get_fdr_client() -> AsyncFdrLambdaClient:
    fern_token = os.getenv("FERN_TOKEN")

    if not fern_token:
        raise ValueError("FERN_TOKEN must be set")

    fdr_lambda_origin = os.getenv("FDR_LAMBDA_ORIGIN")
    if fdr_lambda_origin:
        logger.info(f"Initialized async FDR client with custom environment: {fdr_lambda_origin}")
        return AsyncFdrLambdaClient(environment=fdr_lambda_origin, token=fern_token)

    logger.info("Initialized async FDR client with LAMBDA environment")
    return AsyncFdrLambdaClient(environment=FdrLambdaClientEnvironment.LAMBDA, token=fern_token)
