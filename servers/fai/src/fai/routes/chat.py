from typing import Any

from fastapi import Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from turbopuffer.types.row import Row

from fai.models.utils.chat import format_record
from src.fai.app import fai_app
from src.fai.dependencies import verify_token
from src.fai.models.api.chat_api import (
    PostChatCompletionRequest,
    PostChatCompletionResponse,
)
from src.fai.models.types.chat_types import ChatMessage
from src.fai.utils.chat.response.anthropic import get_anthropic_response
from src.fai.utils.chat.response.cohere import get_cohere_response
from src.fai.utils.chat.retrieve.retrieve import retrieve
from src.settings import LOGGER

SUPPORTED_MODELS = ["claude-4-sonnet-20250514", "command-a-03-2025"]


@fai_app.post(
    "/chat/{domain}",
    response_model=PostChatCompletionResponse,
    openapi_extra={"x-fern-audiences": ["customers"], "security": [{"bearerAuth": []}]},
)
async def post_chat_completion(
    domain: str,
    request: PostChatCompletionRequest,
    _: None = Depends(verify_token),
) -> JSONResponse:
    LOGGER.info(f"Chatting for domain {domain}")
    try:
        messages: list[dict[str, Any]] = [message.to_dict() for message in request.messages]
        last_user_message = messages[-1] if len(messages) > 0 else None

        rag_records: list[str] = []
        if last_user_message:
            query_results: list[Row] = await retrieve(last_user_message["content"], domain)
            rag_records.extend([format_record(result) for result in query_results])

        maybe_system_prompt = request.system_prompt
        model = request.model or "claude-4-sonnet-20250514"

        if model not in SUPPORTED_MODELS:
            raise ValueError(f"Model {model} not supported")

        if model == "command-a-03-2025":
            output_turns, citations = await get_cohere_response(
                maybe_system_prompt, model, messages, domain, rag_records
            )

        elif model == "claude-4-sonnet-20250514":
            output_turns, citations = await get_anthropic_response(
                maybe_system_prompt, model, messages, domain, rag_records
            )

        output: PostChatCompletionResponse = PostChatCompletionResponse(
            turns=[ChatMessage(role="assistant", content=turn["text"]) for turn in output_turns],
            citations=citations,
        )

        return JSONResponse(content=jsonable_encoder(output))

    except Exception as e:
        LOGGER.exception(f"Failed to chat for domain {domain}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
