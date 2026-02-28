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
    RetrievalResult,
    RetrievalStrategy,
)
from fai_ai_core.retrieval.query_decomposition import decompose_query
from fai_ai_core.retrieval.utils import deduplicate_documents
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

AUTH_REQUIRED_MESSAGE = "Sorry, I cannot help you with that question because it requires authentication. Please log in."


def create_auth_error_stream() -> AsyncGenerator[str, None]:
    async def generate() -> AsyncGenerator[str, None]:
        query_id = str(uuid4())
        message_id = str(uuid4())
        yield f'data: {json.dumps({"type": "data-sources", "data": []})}\n\n'
        yield f'data: {json.dumps({"type": "data-assistant-query-id", "data": query_id})}\n\n'
        yield f'data: {json.dumps({"type": "start", "messageId": message_id})}\n\n'
        yield 'data: {"type":"start-step"}\n\n'
        yield 'data: {"type": "text-start", "id": "0"}\n\n'
        yield f'data: {json.dumps({"type": "text-delta", "id": "0", "delta": AUTH_REQUIRED_MESSAGE})}\n\n'
        yield 'data: {"type": "text-end", "id": "0"}\n\n'
        yield 'data: {"type":"finish-step"}\n\n'
        yield 'data: {"type":"finish"}\n\n'
        yield "data: [DONE]\n\n"

    return generate()


@app.post("/chat")
async def chat(
    request: ChatRequest,
    x_fern_host: str = Header(..., alias="x-fern-host"),
    fern_token: str | None = Header(None, alias="FERN_TOKEN"),
    x_fern_basepaths: str | None = Header(None, alias="x-fern-basepaths"),
) -> StreamingResponse:
    domain = x_fern_host.split(":")[0] if ":" in x_fern_host else x_fern_host
    request_start_ms = time.time() * 1000
    logger.info(f"[hanging-thread] POST /chat received for domain={domain}")

    basepaths: list[str] | None = None
    if x_fern_basepaths:
        try:
            basepaths = json.loads(x_fern_basepaths)
            logger.info(f"Chat: basepath-aware query for domain={domain}, basepaths={basepaths}")
        except json.JSONDecodeError:
            logger.warning(f"Chat: failed to parse x-fern-basepaths header: {x_fern_basepaths}")
            logger.info(f"Chat: default query (no basepath filter) for domain={domain}")
    else:
        logger.info(f"Chat: default query (no basepath filter) for domain={domain}")

    pre_check_start_ms = time.time() * 1000
    try:
        auth_result, metadata_result, ask_ai_result = await asyncio.gather(
            fetch_auth_state(domain, fern_token),
            fetch_docs_metadata(domain),
            is_ask_ai_enabled(domain),
            return_exceptions=True,
        )
        pre_check_end_ms = time.time() * 1000
        logger.info(f"[hanging-thread] Pre-checks completed in {pre_check_end_ms - pre_check_start_ms:.2f}ms")

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
        ask_ai_enabled, decompose_queries = ask_ai_result

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

    try:
        retriever = get_retriever()

        roles = auth_state.user.roles if auth_state.authenticated and auth_state.user else []
        exploded_roles = create_exploded_roles(roles) if roles else []

        query_filters = QueryFilters(
            facet_filters=[{"field": f.field, "value": f.value} for f in request.filters],
            document_urls=request.documentUrls if request.documentUrls else None,
            exploded_roles=exploded_roles,
            user_is_authed=auth_state.authenticated,
            basepaths=basepaths,
        )

        subqueries: list[str] | None = None
        query_decomposition_ms: float | None = None

        if decompose_queries:
            logger.info(f"Query decomposition enabled for domain {domain}")

            decomposition_start_ms = time.time() * 1000
            subqueries = await decompose_query(user_query)
            decomposition_end_ms = time.time() * 1000
            query_decomposition_ms = decomposition_end_ms - decomposition_start_ms

            logger.info(f"Decomposed query into {len(subqueries)} sub-queries in {query_decomposition_ms:.2f}ms")
            for index, subquery in enumerate(subqueries):
                logger.info(f"Subquery {index + 1}: {subquery}")

            retrieval_start_ms = time.time() * 1000
            retrieval_queries = [
                RetrievalQuery(
                    query=sq,
                    domain=domain,
                    top_k=TOP_K,
                    strategy=RetrievalStrategy.HYBRID,
                    filters=query_filters,
                )
                for sq in subqueries
            ]
            results = await retriever.batch_retrieve(retrieval_queries)
            all_docs = [doc for result in results for doc in result.documents]
            documents = deduplicate_documents([all_docs])
            retrieval_end_ms = time.time() * 1000

            aggregated_query = RetrievalQuery(
                query=user_query,
                domain=domain,
                top_k=TOP_K,
                strategy=RetrievalStrategy.SEMANTIC,
                filters=query_filters,
            )
            retrieval_result = RetrievalResult(
                documents=documents,
                query=aggregated_query,
                retrieval_time_ms=retrieval_end_ms - retrieval_start_ms,
            )
        else:
            retrieval_start_ms = time.time() * 1000
            retrieval_query = RetrievalQuery(
                query=user_query,
                domain=domain,
                top_k=TOP_K,
                strategy=RetrievalStrategy.SEMANTIC,
                filters=query_filters,
            )
            retrieval_result = await retriever.retrieve(retrieval_query)
            retrieval_end_ms = time.time() * 1000

        doc_count = len(retrieval_result.documents)
        ret_ms = retrieval_result.retrieval_time_ms
        decomp_suffix = f" (query decomposition: {query_decomposition_ms:.2f}ms)" if query_decomposition_ms else ""
        logger.info(f"[hanging-thread] Retrieved {doc_count} documents in {ret_ms:.2f}ms{decomp_suffix}")

        if len(retrieval_result.documents) == 0 and not auth_state.authenticated:
            logger.info("No documents found for unauthenticated user, checking for authenticated content")
            auth_check_filters = QueryFilters(
                facet_filters=[{"field": f.field, "value": f.value} for f in request.filters],
                document_urls=request.documentUrls if request.documentUrls else None,
                exploded_roles=exploded_roles,
                user_is_authed=True,
                basepaths=basepaths,
            )
            auth_check_query = RetrievalQuery(
                query=user_query,
                domain=domain,
                top_k=1,
                strategy=RetrievalStrategy.SEMANTIC,
                filters=auth_check_filters,
            )
            auth_check_result = await retriever.retrieve(auth_check_query)

            if len(auth_check_result.documents) > 0:
                logger.info("Found authenticated content, returning auth required message")
                protocol = VercelUIMessageStreamProtocol()
                return StreamingResponse(
                    create_auth_error_stream(),
                    media_type=protocol.get_media_type(),
                    headers=protocol.get_headers(),
                )
            logger.info("No authenticated content found either, proceeding normally")

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
        msg_build_ms = message_build_end_ms - message_build_start_ms
        logger.info(f"[hanging-thread] Message building completed in {msg_build_ms:.2f}ms")

        logger.info(f"[hanging-thread] Sending {len(llm_messages)} messages to LLM")
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
        logger.info(f"[hanging-thread] LLM provider initialized in {llm_provider_end_ms - llm_provider_start_ms:.2f}ms")
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
            subqueries=subqueries,
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
        logger.info(f"[hanging-thread] generate_stream started for domain={domain}, query_id={query_id}")
        llm_start_ms = time.time() * 1000
        first_token_ms: float | None = None
        input_tokens = 0
        output_tokens = 0
        accumulated_text = ""

        async def track_metrics_and_stream() -> AsyncGenerator[StreamEvent, None]:
            nonlocal first_token_ms, input_tokens, output_tokens, accumulated_text
            logger.info(f"[hanging-thread] Starting provider.generate_stream for domain={domain}")
            event_count = 0
            async for event in provider.generate_stream(llm_messages):
                event_count += 1
                if event.type == StreamEventType.TEXT_DELTA:
                    if first_token_ms is None:
                        first_token_ms = time.time() * 1000
                        logger.info(
                            f"[hanging-thread] First token received for domain={domain}, "
                            f"TTFT={first_token_ms - llm_start_ms:.2f}ms"
                        )
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
                        query_decomposition_ms=query_decomposition_ms,
                    )

                    decomp_log = f", decomposition={query_decomposition_ms:.2f}ms" if query_decomposition_ms else ""
                    logger.info(
                        f"[hanging-thread] USAGE event received, total events so far={event_count} for domain={domain}"
                    )
                    logger.info(
                        f"Request metrics: TTFT={metrics.ttft_ms:.2f}ms, "
                        f"retrieval={metrics.retrieval_time_ms:.2f}ms{decomp_log}, "
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
            logger.info(
                f"[hanging-thread] provider.generate_stream exhausted, total events={event_count} for domain={domain}"
            )

        try:
            logger.info(f"[hanging-thread] Starting protocol.stream_chat for domain={domain}")
            chunk_count = 0
            async for chunk in protocol.stream_chat(
                sources=sources,
                query_id=query_id,
                message_id=message_id,
                text_stream=track_metrics_and_stream(),
            ):
                chunk_count += 1
                yield chunk
            logger.info(
                f"[hanging-thread] protocol.stream_chat completed, total chunks={chunk_count} for domain={domain}"
            )
        except Exception as e:
            logger.exception(f"[hanging-thread] Error during chat streaming: {e}")
            track_chat_request_error(domain, ErrorType.STREAMING_ERROR, status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
            yield f'data: {json.dumps({"type":"error","message":str(e)})}\n\n'
        finally:
            logger.info(
                f"[hanging-thread] generate_stream finally block reached for domain={domain}, query_id={query_id}"
            )
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
                    logger.info(f"[hanging-thread] Awaiting user_save_task for domain={domain}")
                    await user_save_task
                    logger.info(f"[hanging-thread] user_save_task completed for domain={domain}")
                except Exception as e:
                    logger.error(f"[hanging-thread] Failed to save user query: {e}")
            if assistant_save_task:
                try:
                    logger.info(f"[hanging-thread] Awaiting assistant_save_task for domain={domain}")
                    await assistant_save_task
                    logger.info(f"[hanging-thread] assistant_save_task completed for domain={domain}")
                except Exception as e:
                    logger.error(f"[hanging-thread] Failed to save assistant query: {e}")
            logger.info(f"[hanging-thread] generate_stream fully finished for domain={domain}, query_id={query_id}")

    logger.info(f"[hanging-thread] Returning StreamingResponse for domain={domain}, query_id={query_id}")
    return StreamingResponse(
        generate_stream(),
        media_type=protocol.get_media_type(),
        headers=protocol.get_headers(),
    )
