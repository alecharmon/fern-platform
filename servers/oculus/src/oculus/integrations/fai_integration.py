import asyncio
import os
from collections.abc import Callable

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
    system_prompt: str | None = None,
) -> tuple[str, dict[str, str]]:
    _setup_fai_env()

    try:
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

    import json

    retrieved_docs = [
        {
            "slug": result.get("slug", ""),
            "title": result.get("title", ""),
            "content": result.get("content", ""),
            "score": result.get("score", 0.0),
        }
        for result in query_results
    ]
    metadata = {"retrieved_documents": json.dumps(retrieved_docs, indent=2)}

    if model == "command-a-03-2025":
        output_turns, _ = await get_cohere_response(system_prompt, model, messages, domain, rag_records)
    elif model == "claude-4-sonnet-20250514":
        output_turns, _ = await get_anthropic_response(system_prompt, model, messages, domain, rag_records)
    else:
        raise ValueError(f"Unsupported model: {model}")

    if output_turns and len(output_turns) > 0:
        text_turns = [turn["text"] for turn in output_turns if turn.get("type") == "text"]
        return "\n\n".join(text_turns), metadata

    return "ERROR: No response generated", metadata


def create_fai_answer_function(
    domain: str, model: str = "claude-4-sonnet-20250514"
) -> Callable[[str], tuple[str, dict[str, str]]]:
    def answer_fn(question: str) -> tuple[str, dict[str, str]]:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(generate_answer_with_fai(question, domain, model))
            finally:
                loop.close()
        except Exception as e:
            return f"ERROR: {str(e)}", {}

    return answer_fn
