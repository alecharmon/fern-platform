import time

from fastapi.responses import JSONResponse

from fai.app import fai_app
from fai.settings import LOGGER, VARIABLES
from fai.utils.posthog_client import capture_event
from fai.utils.scribe.devin_client import ApiKeyStatus, check_devin_api_key

# TTL cache for the Devin API key check (avoids hitting the Devin API on every ALB poll)
_CACHE_TTL_SECONDS = 300  # 5 minutes
_cached_devin_key_status: str | None = None
_cached_devin_key_ts: float = 0.0


async def _get_devin_key_status() -> str:
    """Return the cached Devin API key status, refreshing if stale."""
    global _cached_devin_key_status, _cached_devin_key_ts  # noqa: PLW0603

    now = time.monotonic()
    if _cached_devin_key_status is not None and (now - _cached_devin_key_ts) < _CACHE_TTL_SECONDS:
        return _cached_devin_key_status

    devin_api_key = VARIABLES.SCRIBE_DEVIN_API_KEY
    if not devin_api_key:
        LOGGER.error("[HEALTH] SCRIBE_DEVIN_API_KEY is not set")
        status = "missing"
    else:
        result = await check_devin_api_key()
        status = result.value
        if result == ApiKeyStatus.INVALID:
            LOGGER.error("[HEALTH] SCRIBE_DEVIN_API_KEY is invalid or expired")
            capture_event(
                "scribe_devin_api_key_invalid",
                {"status": "invalid", "source": "health_check"},
            )
        elif result == ApiKeyStatus.UNREACHABLE:
            LOGGER.warning("[HEALTH] Devin API is unreachable — treating as degraded")

    _cached_devin_key_status = status
    _cached_devin_key_ts = now
    return status


@fai_app.get("/health", openapi_extra={"x-fern-audiences": ["internal"]})
async def health_check() -> JSONResponse:
    """Health check endpoint that returns the application status.

    Validates that the Devin API key (SCRIBE_DEVIN_API_KEY) is present and valid.
    Always returns 200 so the ALB keeps the instance healthy — an expired Devin
    key should not take down the entire fai service (which also serves AI chat).
    The ``checks`` payload exposes the key status for log-based alerting.
    """
    devin_status = await _get_devin_key_status()

    return JSONResponse(content={"status": "hello fernie!", "checks": {"devin_api_key": devin_status}})
