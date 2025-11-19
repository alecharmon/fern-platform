import logging
from collections.abc import AsyncGenerator

from fastapi import (
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse

from ..app import app
from ..llm.factory import get_llm_provider
from ..llm.models import (
    LLMMessage,
    MessageRole,
)

logger = logging.getLogger(__name__)


@app.post("/chat")
async def chat() -> StreamingResponse:
    logger.info("Chat request received")

    try:
        provider = get_llm_provider(model="claude-4.5-haiku", temperature=0.0, max_tokens=200)
    except Exception as e:
        logger.exception(f"Failed to create LLM provider: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLM provider not configured",
        )

    messages = [
        LLMMessage(role=MessageRole.USER, content="Hello, how are you?"),
    ]

    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            async for event in provider.generate_stream(messages):
                yield event.to_sse()
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
