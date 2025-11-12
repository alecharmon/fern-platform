import os

from oculus.integrations.base import AnswerIntegration
from oculus.integrations.fai_http import FAIHTTPIntegration
from oculus.integrations.fai_local import FAILocalIntegration
from oculus.integrations.vercel_http import VercelHTTPIntegration

INTEGRATION_TYPES = ["fai-local", "fai-http", "vercel-http"]


def create_integration(
    integration_type: str,
    domain: str = "",
    model: str = "claude-4-sonnet-20250514",
    system_prompt: str | None = None,
    **kwargs: object,
) -> AnswerIntegration:
    """
    Create an answer integration based on type.

    Args:
        integration_type: Type of integration ("fai-local", "fai-http", "vercel-http")
        domain: Documentation domain
        model: Model to use for generation
        system_prompt: Optional system prompt override
        **kwargs: Additional integration-specific arguments

    Returns:
        An AnswerIntegration instance

    Raises:
        ValueError: If integration_type is not supported

    Environment Variables:
        FAI_URL: Base URL for FAI service (for fai-http)
        FERN_TOKEN: Auth token for FAI (for fai-http)
        VERCEL_URL: Base URL for Vercel docs site (for vercel-http, required)
    """
    integration_type = integration_type.lower()

    if integration_type == "fai-local":
        return FAILocalIntegration(domain=domain, model=model, system_prompt=system_prompt)

    elif integration_type == "fai-http":
        fai_url_kwarg = kwargs.get("fai_url")
        fai_url = (fai_url_kwarg if isinstance(fai_url_kwarg, str) else None) or os.environ.get("FAI_URL")
        fern_token_kwarg = kwargs.get("fern_token")
        fern_token = (fern_token_kwarg if isinstance(fern_token_kwarg, str) else None) or os.environ.get("FERN_TOKEN")
        return FAIHTTPIntegration(
            domain=domain,
            model=model,
            system_prompt=system_prompt,
            fai_url=fai_url,
            fern_token=fern_token,
        )

    elif integration_type == "vercel-http":
        vercel_url_kwarg = kwargs.get("vercel_url")
        vercel_url = (vercel_url_kwarg if isinstance(vercel_url_kwarg, str) else None) or os.environ.get("VERCEL_URL")
        return VercelHTTPIntegration(
            domain=domain,
            model=model,
            system_prompt=system_prompt,
            vercel_url=vercel_url,
        )

    else:
        raise ValueError(
            f"Unsupported integration type: {integration_type}. " f"Supported types: {', '.join(INTEGRATION_TYPES)}"
        )
