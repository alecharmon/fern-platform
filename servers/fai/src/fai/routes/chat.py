from fai_ai_core.llm.factory import get_llm_provider
from fai_ai_core.llm.models import (
    LLMMessage,
    MessageRole,
    ModelId,
)
from fai_ai_core.models.chat import ChatMessage as CoreChatMessage
from fai_ai_core.prompts.system import (
    ChatMode,
    build_messages,
)
from fai_ai_core.retrieval.factory import get_retriever
from fai_ai_core.retrieval.filters import QueryFilters
from fai_ai_core.retrieval.interface import (
    RetrievalQuery,
    RetrievalStrategy,
    RetrievedDocument,
)
from fai_ai_core.retrieval.query_decomposition import decompose_query
from fai_ai_core.retrieval.utils import deduplicate_documents, extract_citations, format_citations
from fai_ai_core.tools.documentation_search import create_documentation_search_tool
from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from fai.app import fai_app
from fai.credits.client import get_credit_client
from fai.credits.config import is_credit_gated
from fai.dependencies import (
    ask_ai_enabled,
    verify_token,
)
from fai.models.api.chat_api import (
    PostChatCompletionRequest,
    PostChatCompletionResponse,
)
from fai.models.types.chat_types import ChatMessage
from fai.settings import LOGGER

SUPPORTED_MODELS: list[ModelId] = [
    "claude-4-sonnet",
    "claude-4.5-sonnet",
    "claude-4.5-haiku",
    "command-a-03-2025",
]
DEFAULT_MODEL: ModelId = "claude-4-sonnet"
TOP_K = 6


def _build_chat_filters(user_is_authed: bool, allowed_roles: list[str] | None) -> QueryFilters:
    if not allowed_roles:
        return QueryFilters(user_is_authed=user_is_authed)
    roles_with_everyone = allowed_roles.copy()
    if "everyone" not in roles_with_everyone:
        roles_with_everyone.append("everyone")
    exploded_roles = sorted(set(filter(None, roles_with_everyone)))
    return QueryFilters(user_is_authed=user_is_authed, exploded_roles=exploded_roles)


@fai_app.post(
    "/chat/{domain}",
    response_model=PostChatCompletionResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def post_chat_completion(
    domain: str,
    request: PostChatCompletionRequest,
    _: None = Depends(verify_token),
    __: None = Depends(ask_ai_enabled),
) -> JSONResponse:
    LOGGER.info(f"Chatting for domain {domain}")
    try:
        filters = _build_chat_filters(request.user_is_authed, request.allowed_roles)
        LOGGER.info(f"Chat filters: user_is_authed={request.user_is_authed}, allowed_roles={request.allowed_roles}")

        user_messages = [CoreChatMessage(role=msg.role, content=msg.content) for msg in request.messages]
        last_user_message = user_messages[-1] if user_messages else None

        retriever = get_retriever()
        retrieved_documents: list[RetrievedDocument] = []

        if last_user_message:
            query_content = last_user_message.content

            if request.rewrite_query:
                LOGGER.info(f"Query rewriting enabled for domain {domain}")
                sub_queries = await decompose_query(query_content)
                LOGGER.info(f"Decomposed query into {len(sub_queries)} sub-queries")
                for index, sub_query in enumerate(sub_queries):
                    LOGGER.info(f"Subquery {index + 1}: {sub_query}")

                retrieval_queries = [
                    RetrievalQuery(
                        query=sq,
                        domain=domain,
                        strategy=RetrievalStrategy.HYBRID,
                        top_k=TOP_K,
                        filters=filters,
                    )
                    for sq in sub_queries
                ]
                results = await retriever.batch_retrieve(retrieval_queries)
                all_docs = [doc for result in results for doc in result.documents]
                retrieved_documents = deduplicate_documents([all_docs])
            else:
                retrieval_query = RetrievalQuery(
                    query=query_content,
                    domain=domain,
                    strategy=RetrievalStrategy.HYBRID,
                    top_k=TOP_K,
                    filters=filters,
                )
                result = await retriever.retrieve(retrieval_query)
                retrieved_documents = result.documents

        model: ModelId = DEFAULT_MODEL
        if request.model and request.model in SUPPORTED_MODELS:
            model = request.model  # type: ignore

        messages_with_context = build_messages(
            user_messages=user_messages,
            retrieved_docs=retrieved_documents,
            domain=domain,
            customer_system_prompt=request.system_prompt,
            mode=ChatMode.MARKDOWN,
        )

        llm_messages = [
            LLMMessage(
                role=MessageRole.SYSTEM if msg["role"] == "system" else MessageRole(msg["role"]),
                content=msg["content"],
            )
            for msg in messages_with_context
        ]

        initial_urls: set[str] = set()
        for doc in retrieved_documents:
            if doc.metadata:
                url = doc.metadata.get("url")
                if url:
                    initial_urls.add(url)

        search_tool = create_documentation_search_tool(
            retriever=retriever,
            domain=domain,
            filters=filters,
            top_k=5,
            max_calls=2,
            already_retrieved_urls=initial_urls,
        )

        provider = get_llm_provider(
            model=model,
            temperature=0.0,
            max_tokens=request.max_tokens,
        )

        credit_client = get_credit_client()
        resolved_org = None
        if credit_client:
            try:
                resolved_org = await credit_client._resolve_org_id(domain)
                if is_credit_gated(resolved_org):
                    credit_result = await credit_client.check_credits(domain, resolved_org)
                    if not credit_result.allowed:
                        return JSONResponse(
                            status_code=429,
                            content={"detail": "AI credit limit reached"},
                        )
            except Exception as e:
                LOGGER.error(f"Credit check failed, allowing request: {e}")

        response = await provider.generate(llm_messages, tools=[search_tool])

        LOGGER.info(
            f"Chat completed for domain {domain}: "
            f"model={response.model_id}, "
            f"input_tokens={response.metrics.input_tokens}, "
            f"output_tokens={response.metrics.output_tokens}, "
            f"total_time_ms={response.metrics.total_time_ms:.0f}"
        )

        if credit_client and resolved_org and is_credit_gated(resolved_org) and response.metrics.output_tokens > 0:
            try:
                await credit_client.log_usage(
                    domain,
                    question=last_user_message.content if last_user_message else "",
                    response_tokens=response.metrics.output_tokens,
                    org_id=resolved_org,
                )
            except Exception as e:
                LOGGER.error(f"Failed to log credit usage: {e}")

        citations = format_citations(extract_citations(retrieved_documents))

        output = PostChatCompletionResponse(
            turns=[ChatMessage(role="assistant", content=response.content)],
            citations=citations,
        )

        return JSONResponse(content=jsonable_encoder(output))

    except Exception as e:
        LOGGER.exception(f"Failed to chat for domain {domain}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
