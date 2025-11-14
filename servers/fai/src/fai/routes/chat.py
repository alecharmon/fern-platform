import asyncio
from typing import Any

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from turbopuffer.types.row import Row

from fai.app import fai_app
from fai.dependencies import (
    ask_ai_enabled,
    verify_token,
)
from fai.models.api.chat_api import (
    PostChatCompletionRequest,
    PostChatCompletionResponse,
)
from fai.models.enums.language_models import LanguageModel
from fai.models.types.chat_types import ChatMessage
from fai.models.utils.chat import (
    deduplicate_retrieved_sources,
    format_record,
)
from fai.settings import LOGGER
from fai.utils.chat.query_rewriter import rewrite_query
from fai.utils.chat.response.anthropic import get_anthropic_response
from fai.utils.chat.response.cohere import get_cohere_response
from fai.utils.chat.retrieve.retrieve import retrieve

SUPPORTED_COHERE_MODELS = [LanguageModel.command_a]
SUPPORTED_ANTHROPIC_MODELS = [
    LanguageModel.claude_haiku_4_5,
    LanguageModel.claude_sonnet_4_5,
    LanguageModel.claude_sonnet_4,
]
DEFAULT_MODEL = LanguageModel.claude_sonnet_4


@fai_app.post(
    "/chat/{domain}",
    response_model=PostChatCompletionResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def post_chat_completion(
    domain: str, request: PostChatCompletionRequest, _: None = Depends(verify_token), __: None = Depends(ask_ai_enabled)
) -> JSONResponse:
    LOGGER.info(f"Chatting for domain {domain}")
    try:
        messages: list[dict[str, Any]] = [message.to_dict() for message in request.messages]
        last_user_message = messages[-1] if len(messages) > 0 else None

        rag_records: list[str] = []
        if last_user_message:
            query_content = last_user_message["content"]

            if request.rewrite_query:
                LOGGER.info(f"Query rewriting enabled for domain {domain}")
                sub_queries = await rewrite_query(query_content)
                LOGGER.info(f"Decomposed query into {len(sub_queries)} sub-queries")
                for index, sub_query in enumerate(sub_queries):
                    LOGGER.info(f"SUBQUERY {index + 1}: {sub_query}")

                query_results_list = await asyncio.gather(*[retrieve(sub_query, domain) for sub_query in sub_queries])

                deduplicated_rows = deduplicate_retrieved_sources(query_results_list)
                rag_records.extend([format_record(row) for row in deduplicated_rows])
            else:
                query_results: list[Row] = await retrieve(query_content, domain)
                rag_records.extend([format_record(result) for result in query_results])

        maybe_system_prompt = request.system_prompt
        model = request.model or DEFAULT_MODEL
        max_tokens = request.max_tokens

        if model in SUPPORTED_COHERE_MODELS:
            output_turns, citations = await get_cohere_response(
                maybe_system_prompt, model, messages, domain, rag_records, max_tokens=max_tokens
            )

        elif model in SUPPORTED_ANTHROPIC_MODELS:
            output_turns, citations = await get_anthropic_response(
                maybe_system_prompt, model, messages, domain, rag_records, max_tokens=max_tokens
            )

        output: PostChatCompletionResponse = PostChatCompletionResponse(
            turns=[ChatMessage(role="assistant", content=turn["text"]) for turn in output_turns],
            citations=citations,
        )

        return JSONResponse(content=jsonable_encoder(output))

    except Exception as e:
        LOGGER.exception(f"Failed to chat for domain {domain}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
