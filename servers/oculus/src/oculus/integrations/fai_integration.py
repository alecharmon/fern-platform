import os
from typing import Any, Optional

_FAI_ENV_VARS = {
    "COHERE_API_KEY": "dummy",
    "POSTGRES_DATABASE_URL": "postgresql://localhost/fai",
    "ASK_FERN_SLACK_BOT_TOKEN": "",
    "FERNIE_SLACK_BOT_TOKEN": "",
    "SLACK_CLIENT_ID": "",
    "SLACK_CLIENT_SECRET": "",
    "SLACK_SIGNING_SECRET": "",
    "FAI_LAMBDA_FUNCTION_NAME": "",
    "DISCORD_BOT_TOKEN": "",
    "DISCORD_OAUTH_URL": "",
    "KV_REST_API_TOKEN": "",
    "KV_REST_API_READ_ONLY_TOKEN": "",
    "KV_REST_API_URL": "",
    "FERN_TOKEN": "",
    "VENUS_URL": "",
}


def _setup_fai_env() -> None:
    for key, default_value in _FAI_ENV_VARS.items():
        if key not in os.environ:
            os.environ[key] = default_value


async def generate_answer_with_fai(
    question: str,
    domain: str,
    model: str = "claude-4-sonnet-20250514",
    system_prompt: Optional[str] = None,
) -> str:
    _setup_fai_env()

    try:
        from fai.models.api.chat_api import PostChatCompletionRequest
        from fai.models.types.chat_types import ChatMessage
        from fai.models.utils.chat import format_record
        from fai.utils.chat.response.anthropic import get_anthropic_response
        from fai.utils.chat.response.cohere import get_cohere_response
        from fai.utils.chat.retrieve.retrieve import retrieve
    except ImportError as e:
        raise ImportError(f"Failed to import FAI modules: {e}")

    message = ChatMessage(role="user", content=question)
    messages = [message.to_dict()]

    query_results = await retrieve(question, domain)
    rag_records = [format_record(result) for result in query_results]

    if model == "command-a-03-2025":
        output_turns, _ = await get_cohere_response(system_prompt, model, messages, domain, rag_records)
    elif model == "claude-4-sonnet-20250514":
        output_turns, _ = await get_anthropic_response(system_prompt, model, messages, domain, rag_records)
    else:
        raise ValueError(f"Unsupported model: {model}")

    if output_turns and len(output_turns) > 0:
        return str(output_turns[0]["text"])

    return "ERROR: No response generated"


def create_fai_answer_function(domain: str, model: str = "claude-4-sonnet-20250514") -> Any:
    import asyncio
    from typing import Callable

    def answer_fn(question: str) -> str:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(generate_answer_with_fai(question, domain, model))
            finally:
                loop.close()
        except Exception as e:
            return f"ERROR: {str(e)}"

    return answer_fn
