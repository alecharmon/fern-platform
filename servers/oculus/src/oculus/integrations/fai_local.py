import asyncio
import json
import os
import time

from oculus.integrations.base import AnswerMetadata, SourceMetadata

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


class FAILocalIntegration:
    """Integration that calls FAI functions directly (in-process)."""

    def __init__(self, domain: str, model: str = "claude-4-sonnet-20250514", system_prompt: str | None = None):
        self.domain = domain
        self.model = model
        self.system_prompt = system_prompt
        _setup_fai_env()

    async def _generate_answer_async(self, question: str) -> tuple[str, AnswerMetadata]:
        start_time = time.time()

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

        query_results = await retrieve(question, self.domain)
        rag_records = [format_record(result) for result in query_results]

        sources: list[SourceMetadata] = [
            {
                "slug": getattr(result, "slug", None),
                "title": getattr(result, "title", None),
                "url": getattr(result, "url", None),
            }
            for result in query_results
        ]

        retrieved_docs = [
            {
                "slug": getattr(result, "slug", ""),
                "title": getattr(result, "title", ""),
                "content": getattr(result, "content", ""),
                "score": getattr(result, "score", 0.0),
            }
            for result in query_results
        ]

        if self.model == "command-a-03-2025":
            output_turns, _ = await get_cohere_response(
                self.system_prompt,
                self.model,
                messages,
                self.domain,
                rag_records,
            )
        elif self.model == "claude-4-sonnet-20250514":
            output_turns, _ = await get_anthropic_response(
                self.system_prompt, self.model, messages, self.domain, rag_records
            )
        else:
            raise ValueError(f"Unsupported model: {self.model}")

        if output_turns and len(output_turns) > 0:
            text_turns = [turn["text"] for turn in output_turns if turn.get("type") == "text"]
            answer_text = "\n\n".join(text_turns)
        else:
            answer_text = "ERROR: No response generated"

        response_time_ms = (time.time() - start_time) * 1000
        metadata: AnswerMetadata = {
            "integration_type": "fai-local",
            "model": self.model,
            "sources": sources,
            "fai_local_retrieved_documents": json.dumps(retrieved_docs, indent=2),
            "response_time_ms": response_time_ms,
        }

        return answer_text, metadata

    def generate_answer(self, question: str) -> tuple[str, AnswerMetadata]:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(self._generate_answer_async(question))
            finally:
                loop.close()
        except Exception as e:
            error_metadata: AnswerMetadata = {
                "integration_type": "fai-local",
                "model": self.model,
                "sources": [],
            }
            return f"ERROR: {str(e)}", error_metadata
