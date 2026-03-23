import functools
import logging
import os

from fdr_lambda import AsyncFdrLambdaClient

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def get_fdr_client() -> AsyncFdrLambdaClient:
    fern_token = os.getenv("FERN_TOKEN")
    environment_type = os.getenv("ENVIRONMENT_TYPE", "unknown")

    if not fern_token:
        raise ValueError(
            f"FERN_TOKEN must be set. Environment: {environment_type}. "
            "For dev2 deployments, ensure DEV_FERN_TOKEN is configured in GitHub secrets "
            "and the CDK stack maps it to FERN_TOKEN."
        )

    fdr_lambda_origin = os.getenv("FDR_LAMBDA_ORIGIN")
    if not fdr_lambda_origin:
        raise ValueError(
            f"FDR_LAMBDA_ORIGIN must be set. Environment: {environment_type}. "
            "This should point to the FDR Lambda service (e.g. https://registry-v2.buildwithfern.com)."
        )

    logger.info(f"Initialized async FDR client: environment={fdr_lambda_origin}, env_type={environment_type}")
    return AsyncFdrLambdaClient(base_url=fdr_lambda_origin, token=fern_token)
