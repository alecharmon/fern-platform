import logging
import time
from collections.abc import AsyncGenerator

from fastapi import (
    Header,
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse

from ..app import app
from ..llm.factory import get_llm_provider
from ..llm.models import (
    LLMMessage,
    MessageRole,
    StreamEventType,
)
from ..metadata.fetcher import (
    fetch_docs_metadata,
    validate_docs_metadata,
)
from ..models.metrics import RequestMetrics
from ..models.request import ChatRequest
from ..prompts.system import build_messages
from ..retrieval.factory import get_retriever
from ..retrieval.interface import (
    RetrievalQuery,
    RetrievalStrategy,
)
from ..settings.ask_ai import is_ask_ai_enabled

logger = logging.getLogger(__name__)


@app.post("/chat")
async def chat(
    request: ChatRequest,
    x_fern_host: str = Header(..., alias="x-fern-host"),
) -> StreamingResponse:
    domain = x_fern_host
    request_start_ms = time.time() * 1000
    logger.info(f"Chat request received for domain: {domain}")

    try:
        metadata = await fetch_docs_metadata(domain)
        validate_docs_metadata(metadata)
    except ValueError as e:
        logger.error(f"Metadata validation failed: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    try:
        ask_ai_enabled = await is_ask_ai_enabled(domain)
        if not ask_ai_enabled:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ask AI is not enabled for this domain",
            )
    except ValueError as e:
        logger.error(f"Ask AI check failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    user_query = request.messages[-1].content
    logger.info(f"User query: {user_query[:100]}...")

    retrieval_start_ms = time.time() * 1000
    try:
        retriever = get_retriever()
        retrieval_query = RetrievalQuery(
            query=user_query,
            domain=domain,
            top_k=5,
            strategy=RetrievalStrategy.HYBRID,
        )
        retrieval_result = await retriever.retrieve(retrieval_query)
        retrieval_end_ms = time.time() * 1000

        logger.info(
            f"Retrieved {len(retrieval_result.documents)} documents in "
            f"{retrieval_result.retrieval_time_ms:.2f}ms"
        )
    except Exception as e:
        logger.exception(f"Retrieval failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve documents",
        )

    try:
        messages_with_context = build_messages(
            user_messages=request.messages,
            retrieved_docs=retrieval_result.documents,
            domain=domain,
        )

        llm_messages = [
            LLMMessage(
                role=MessageRole.SYSTEM if msg["role"] == "system" else MessageRole(msg["role"]),
                content=msg["content"],
            )
            for msg in messages_with_context
        ]

        logger.info(f"Sending {len(llm_messages)} messages to LLM")
        for i, msg in enumerate(llm_messages):
            content_len = len(msg.content)
            if msg.role == MessageRole.SYSTEM:
                logger.info(f"  Message {i} (system): {content_len} chars total")
                logger.info(f"    First 200 chars: {msg.content[:200]}...")
                logger.info(f"    Last 200 chars: ...{msg.content[-200:]}")
            else:
                logger.info(f"  Message {i} ({msg.role.value}): {msg.content}")
    except Exception as e:
        logger.exception(f"Failed to build messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to prepare messages",
        )

    try:
        provider = get_llm_provider(model="claude-4", temperature=0.0, max_tokens=4096)
    except Exception as e:
        logger.exception(f"Failed to create LLM provider: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLM provider not configured",
        )

    async def generate_stream() -> AsyncGenerator[str, None]:
        llm_start_ms = time.time() * 1000
        first_token_ms = None
        input_tokens = 0
        output_tokens = 0

        try:
            async for event in provider.generate_stream(llm_messages):
                if event.type == StreamEventType.TEXT_DELTA and first_token_ms is None:
                    first_token_ms = time.time() * 1000

                if event.type == StreamEventType.USAGE:
                    usage_data = event.data
                    if isinstance(usage_data, dict):
                        input_tokens = usage_data.get("input_tokens", 0)
                        output_tokens = usage_data.get("output_tokens", 0)

                    llm_end_ms = time.time() * 1000

                    metrics = RequestMetrics(
                        request_received_ms=request_start_ms,
                        retrieval_start_ms=retrieval_start_ms,
                        retrieval_end_ms=retrieval_end_ms,
                        llm_start_ms=llm_start_ms,
                        first_token_ms=first_token_ms,
                        llm_end_ms=llm_end_ms,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                    )

                    logger.info(
                        f"Request metrics: TTFT={metrics.ttft_ms:.2f}ms, "
                        f"retrieval={metrics.retrieval_time_ms:.2f}ms, "
                        f"llm_total={metrics.total_llm_time_ms:.2f}ms, "
                        f"total={metrics.total_request_time_ms:.2f}ms, "
                        f"tokens={input_tokens}/{output_tokens}"
                    )

                    enriched_usage = usage_data.copy() if isinstance(usage_data, dict) else {}
                    enriched_usage.update(metrics.to_dict())
                    event.data = enriched_usage

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
