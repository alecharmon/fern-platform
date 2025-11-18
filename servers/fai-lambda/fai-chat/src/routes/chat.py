import logging
import os
from collections.abc import AsyncGenerator

from anthropic import AsyncAnthropic
from fastapi import (
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse

from ..app import app

logger = logging.getLogger(__name__)


@app.post("/chat")
async def chat() -> StreamingResponse:
    logger.info("Chat request received")

    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ANTHROPIC_API_KEY not configured",
        )

    client = AsyncAnthropic(api_key=anthropic_api_key)

    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            async with client.messages.stream(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                messages=[{"role": "user", "content": "Hello, how are you?"}],
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {text}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.exception(f"Error during chat streaming: {e}")
            yield f'data: {{"error": "{str(e)}"}}\n\n'

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
