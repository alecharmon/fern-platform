import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from datetime import (
    UTC,
    datetime,
)
from uuid import uuid4

from fai_ai_core.llm.factory import get_llm_provider
from fai_ai_core.llm.models import (
    LLMMessage,
    MessageRole,
    StreamEvent,
    StreamEventType,
)
from fai_ai_core.prompts.system import build_messages
from fai_ai_core.retrieval.factory import get_retriever
from fai_ai_core.retrieval.filters import QueryFilters
from fai_ai_core.retrieval.interface import (
    RetrievalQuery,
    RetrievalStrategy,
)
from fastapi import (
    Header,
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse

from ..analytics.events import (
    ErrorType,
    track_chat_request_error,
    track_chat_request_success,
    track_llm_provider_fallback,
)
from ..app import app
from ..auth.models import AuthState
from ..auth.roles import create_exploded_roles
from ..auth.verification import fetch_auth_state
from ..clients.fai_client import get_fai_client
from ..exceptions import (
    AskAICheckError,
    MetadataValidationError,
)
from ..metadata.fetcher import (
    fetch_docs_metadata,
    validate_docs_metadata,
)
from ..models.metrics import RequestMetrics
from ..models.request import ChatRequest
from ..models.stream import convert_documents_to_sources
from ..queries.models import QueryData
from ..queries.writer import save_query
from ..settings.ask_ai import is_ask_ai_enabled
from ..streaming.protocols.vercel_ui import VercelUIMessageStreamProtocol

logger = logging.getLogger(__name__)

TOP_K = 6


@app.post("/chat")
async def chat(
    request: ChatRequest,
    x_fern_host: str = Header(..., alias="x-fern-host"),
    fern_token: str | None = Header(None, alias="FERN_TOKEN"),
) -> StreamingResponse:
    domain = x_fern_host.split(":")[0] if ":" in x_fern_host else x_fern_host
    request_start_ms = time.time() * 1000
    logger.info(f"Chat request received for domain: {domain}")

    pre_check_start_ms = time.time() * 1000
    try:
        auth_result, metadata_result, ask_ai_result = await asyncio.gather(
            fetch_auth_state(domain, fern_token),
            fetch_docs_metadata(domain),
            is_ask_ai_enabled(domain),
            return_exceptions=True,
        )
        pre_check_end_ms = time.time() * 1000
        logger.info(f"Pre-checks completed in {pre_check_end_ms - pre_check_start_ms:.2f}ms")

        if isinstance(auth_result, BaseException):
            logger.warning(f"Auth check failed, treating as unauthenticated: {auth_result}")
            auth_state = AuthState(authenticated=False)
        else:
            auth_state = auth_result

        if isinstance(metadata_result, BaseException):
            raise metadata_result
        metadata = metadata_result
        validate_docs_metadata(metadata)

        if isinstance(ask_ai_result, BaseException):
            raise ask_ai_result
        ask_ai_enabled = ask_ai_result

    except MetadataValidationError as e:
        logger.error(f"Metadata validation failed: {e}")
        track_chat_request_error(domain, ErrorType.METADATA_VALIDATION_FAILED, status.HTTP_404_NOT_FOUND, str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AskAICheckError as e:
        logger.error(f"Ask AI check failed: {e}")
        track_chat_request_error(domain, ErrorType.ASK_AI_CHECK_FAILED, status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"Pre-check failed with unexpected error: {e}")
        track_chat_request_error(domain, ErrorType.PRE_CHECK_FAILED, status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if not ask_ai_enabled:
        track_chat_request_error(domain, ErrorType.ASK_AI_NOT_ENABLED, status.HTTP_404_NOT_FOUND)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ask AI is not enabled for this domain",
        )

    simple_messages = request.get_simple_messages()
    user_query = simple_messages[-1].content
    logger.info(f"User query: {user_query[:100]}...")
    logger.info(
        f"Request metadata: source={request.source}, "
        f"conversationId={request.conversationId}, queryId={request.queryId}"
    )

    retrieval_start_ms = time.time() * 1000
    try:
        retriever = get_retriever()

        roles = auth_state.user.roles if auth_state.authenticated and auth_state.user else []
        exploded_roles = create_exploded_roles(roles) if roles else []

        query_filters = QueryFilters(
            facet_filters=[{"field": f.field, "value": f.value} for f in request.filters],
            document_urls=request.documentUrls if request.documentUrls else None,
            exploded_roles=exploded_roles,
            user_is_authed=auth_state.authenticated,
        )
        retrieval_query = RetrievalQuery(
            query=user_query,
            domain=domain,
            top_k=TOP_K,
            strategy=RetrievalStrategy.HYBRID,
            filters=query_filters,
        )
        retrieval_result = await retriever.retrieve(retrieval_query)
        retrieval_end_ms = time.time() * 1000

        logger.info(
            f"Retrieved {len(retrieval_result.documents)} documents in " f"{retrieval_result.retrieval_time_ms:.2f}ms"
        )
    except Exception as e:
        logger.exception(f"Retrieval failed: {e}")
        track_chat_request_error(domain, ErrorType.RETRIEVAL_FAILED, status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve documents",
        )

    message_build_start_ms = time.time() * 1000
    try:
        messages_with_context = build_messages(
            user_messages=simple_messages,
            retrieved_docs=retrieval_result.documents,
            domain=domain,
            customer_system_prompt=request.customerSystemPrompt,
        )

        llm_messages = [
            LLMMessage(
                role=MessageRole.SYSTEM if msg["role"] == "system" else MessageRole(msg["role"]),
                content=msg["content"],
            )
            for msg in messages_with_context
        ]
        message_build_end_ms = time.time() * 1000
        logger.info(f"Message building completed in {message_build_end_ms - message_build_start_ms:.2f}ms")

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
        track_chat_request_error(domain, ErrorType.MESSAGE_BUILD_FAILED, status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to prepare messages",
        )

    llm_provider_start_ms = time.time() * 1000
    model_id = request.model or "claude-4-sonnet"
    try:
        provider = get_llm_provider(
            model=model_id,
            temperature=0.0,
            max_tokens=4096,
            fallback_callback=track_llm_provider_fallback,
        )
        llm_provider_end_ms = time.time() * 1000
        logger.info(f"LLM provider initialized in {llm_provider_end_ms - llm_provider_start_ms:.2f}ms")
    except Exception as e:
        logger.exception(f"Failed to create LLM provider: {e}")
        track_chat_request_error(domain, ErrorType.LLM_PROVIDER_FAILED, status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLM provider not configured",
        )

    message_id = str(uuid4())
    query_id = request.queryId or str(uuid4())
    conversation_id = request.conversationId or str(uuid4())
    sources = convert_documents_to_sources(retrieval_result.documents)
    chat_source = request.source or "CHAT"

    user_save_task: asyncio.Task[str | None] | None = None
    if not request.skipSaveQuery:
        user_query_data = QueryData(
            query_id=query_id,
            conversation_id=conversation_id,
            domain=domain,
            text=user_query,
            role="USER",
            source=chat_source,
            created_at=datetime.now(UTC),
        )
        user_save_task = asyncio.create_task(save_query(get_fai_client(), user_query_data))

    initial_urls: set[str] = set()
    for doc in retrieval_result.documents:
        if doc.metadata:
            url = doc.metadata.get("url")
            if url:
                initial_urls.add(url)

    protocol = VercelUIMessageStreamProtocol()

    async def generate_stream() -> AsyncGenerator[str, None]:
        llm_start_ms = time.time() * 1000
        first_token_ms: float | None = None
        input_tokens = 0
        output_tokens = 0
        accumulated_text = ""

        async def track_metrics_and_stream() -> AsyncGenerator[StreamEvent, None]:
            nonlocal first_token_ms, input_tokens, output_tokens, accumulated_text
            async for event in provider.generate_stream(llm_messages):
                if event.type == StreamEventType.TEXT_DELTA:
                    if first_token_ms is None:
                        first_token_ms = time.time() * 1000
                    if isinstance(event.data, str):
                        accumulated_text += event.data

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

                    track_chat_request_success(
                        domain=domain,
                        metrics=metrics,
                        llm_provider=provider.provider_name,
                        message_count=len(llm_messages),
                    )

                yield event

        try:
            async for chunk in protocol.stream_chat(
                sources=sources,
                query_id=query_id,
                message_id=message_id,
                text_stream=track_metrics_and_stream(),
            ):
                yield chunk
        except Exception as e:
            logger.exception(f"Error during chat streaming: {e}")
            track_chat_request_error(domain, ErrorType.STREAMING_ERROR, status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
            yield f'data: {json.dumps({"type":"error","message":str(e)})}\n\n'
        finally:
            assistant_save_task: asyncio.Task[str | None] | None = None
            if not request.skipSaveQuery and accumulated_text:
                ttft_ms = (first_token_ms - llm_start_ms) if first_token_ms else None
                assistant_query_data = QueryData(
                    query_id=str(uuid4()),
                    conversation_id=conversation_id,
                    domain=domain,
                    text=accumulated_text,
                    role="ASSISTANT",
                    source=chat_source,
                    created_at=datetime.now(UTC),
                    time_to_first_token=ttft_ms,
                )
                assistant_save_task = asyncio.create_task(save_query(get_fai_client(), assistant_query_data))

            if user_save_task:
                try:
                    await user_save_task
                except Exception as e:
                    logger.error(f"Failed to save user query: {e}")
            if assistant_save_task:
                try:
                    await assistant_save_task
                except Exception as e:
                    logger.error(f"Failed to save assistant query: {e}")

    return StreamingResponse(
        generate_stream(),
        media_type=protocol.get_media_type(),
        headers=protocol.get_headers(),
    )
