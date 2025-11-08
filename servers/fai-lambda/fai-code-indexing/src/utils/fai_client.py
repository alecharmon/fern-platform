"""FAI SDK client utilities."""

import os

from fern_fai_sdk import FernAI


def get_fai_client() -> FernAI:
    """Get FAI client configured from environment variables.

    Environment Variables:
        FAI_URL: The base URL for the FAI service (default: http://localhost:8000)
        FERN_TOKEN: The authentication token for FAI API

    Returns:
        Configured FernAI client instance
    """
    fai_url = os.environ.get("FAI_URL", "https://fai.buildwithfern.com")
    fern_token = os.environ.get("FERN_TOKEN", "")
    return FernAI(base_url=fai_url, token=fern_token)
