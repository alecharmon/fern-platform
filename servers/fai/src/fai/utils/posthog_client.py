import logging
from functools import lru_cache

from posthog import Posthog

from fai.settings import VARIABLES

logger = logging.getLogger(__name__)

DISTINCT_ID = "fai-server-side-event"


@lru_cache
def get_posthog_client() -> Posthog | None:
    api_key = VARIABLES.POSTHOG_API_KEY
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
        logger.error(f"[posthog] Failed to initialize PostHog client: {e}")
        return None


def capture_event(event: str, properties: dict[str, object] | None = None) -> None:
    """Send an event to PostHog. Silently no-ops when the client is unavailable."""
    try:
        client = get_posthog_client()
        if client is None:
            return

        client.capture(
            distinct_id=DISTINCT_ID,
            event=event,
            properties={"$process_person_profile": False, **(properties or {})},
        )
    except Exception as e:
        logger.error(f"[posthog] Failed to capture PostHog event {event}: {e}")
