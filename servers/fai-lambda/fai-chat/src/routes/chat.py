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
from ..metadata.fetcher import (
    fetch_docs_metadata,
    validate_docs_metadata,
)
from ..models.request import ChatRequest
from ..settings.ask_ai import is_ask_ai_enabled

logger = logging.getLogger(__name__)


@app.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    logger.info(f"Chat request received for domain: {request.domain}")

    try:
        metadata = await fetch_docs_metadata(request.domain)
        validate_docs_metadata(metadata)
    except ValueError as e:
        logger.error(f"Metadata validation failed: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    try:
        ask_ai_enabled = await is_ask_ai_enabled(request.domain)
        if not ask_ai_enabled:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ask AI is not enabled for this domain",
            )
    except ValueError as e:
        logger.error(f"Ask AI check failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

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
