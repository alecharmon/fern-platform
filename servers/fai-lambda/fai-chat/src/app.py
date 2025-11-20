import logging
from typing import Annotated

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    status,
)

from src.middleware.posthog_middleware import PostHogMiddleware

logger = logging.getLogger()
logger.setLevel(logging.INFO)

app = FastAPI(
    title="FAI Chat Service",
    version="0.1.0",
    description="Lambda-based chat endpoint for Fern AI",
)

app.add_middleware(PostHogMiddleware)


def get_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization token",
        )

    return auth_header[7:]


BearerToken = Annotated[str, Depends(get_bearer_token)]


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "fai-chat"}


from .routes import chat  # noqa: E402, F401
