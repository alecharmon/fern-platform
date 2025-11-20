import logging
from collections.abc import (
    Awaitable,
    Callable,
)

from fastapi import (
    Request,
    Response,
)
from starlette.middleware.base import BaseHTTPMiddleware

from src.analytics.posthog_client import get_posthog_client

logger = logging.getLogger(__name__)


class PostHogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)

        try:
            client = get_posthog_client()
            if client:
                client.flush()
        except Exception as e:
            logger.error(f"Failed to flush PostHog events: {e}")

        return response
