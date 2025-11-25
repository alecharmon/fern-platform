import logging
import os
from functools import lru_cache

from posthog import Posthog

logger = logging.getLogger(__name__)


def get_posthog_api_key() -> str | None:
    key = os.getenv("POSTHOG_API_KEY")
    if key is None:
        return None
    return key.strip()


@lru_cache
def get_posthog_client() -> Posthog | None:
    api_key = get_posthog_api_key()
    if not api_key:
        logger.info("PostHog API key not configured, analytics disabled")
        return None

    try:
        client = Posthog(
            project_api_key=api_key,
            flush_at=10,
            flush_interval=10,
        )
        logger.info("PostHog client initialized successfully")
        return client
    except Exception as e:
        logger.error(f"Failed to initialize PostHog client: {e}")
        return None
