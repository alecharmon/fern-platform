from typing import Any

from anthropic import AsyncAnthropic
from turbopuffer.types.row import Row

from src.fai.models.utils.chat import (
    ChatMode,
    format_record,
)
from src.fai.utils.chat.prompts.anthropic import build_anthropic_system_prompt
from src.fai.utils.chat.retrieve.retrieve import retrieve
from src.fai.utils.chat.tools import (
    SAVE_SLACK_CONTEXT_TOOL_ANTHROPIC,
    SEARCH_TOOL_ANTHROPIC,
)
from src.settings import VARIABLES


async def get_anthropic_response(
    maybe_system_prompt: str | None,
    model: str,
    messages: list[dict[str, Any]],
    domain: str,
    rag_records: list[str],
    mode: ChatMode = ChatMode.MARKDOWN,
) -> tuple[list[dict[str, str]], list[str]]:
    async def _handle_anthropic_tool_use(tool_use: Any, domain: str) -> tuple[str, list[str]]:
        query = tool_use.input["query"]
        query_results: list[Row] = await retrieve(query, domain)
        rag_records = [format_record(result) for result in query_results]
        return tool_use.id, rag_records

    system_prompt = (
        maybe_system_prompt
        if maybe_system_prompt
        else build_anthropic_system_prompt(domain, mode, "\n\n".join(rag_records))
    )

    async with AsyncAnthropic(api_key=VARIABLES.ANTHROPIC_API_KEY) as anthropic_client:
        output = []
        citations = [*rag_records]

        current_messages = messages.copy()

        while True:
            response = await anthropic_client.messages.create(
                system=system_prompt,
                model=model,
                messages=current_messages,
                max_tokens=1000,
                tools=[SEARCH_TOOL_ANTHROPIC],
            )

            for turn in response.content:
                if turn.type == "text":
                    output.append({"type": "text", "text": turn.text})

            tool_uses = [turn for turn in response.content if turn.type == "tool_use"]

            if not tool_uses:
                break

            tool_results = []
            for tool_use in tool_uses:
                if tool_use.name == "search":
                    tool_use_id, search_rag_records = await _handle_anthropic_tool_use(tool_use, domain)
                    tool_results.append(
                        {"type": "tool_result", "tool_use_id": tool_use_id, "content": "\n\n".join(search_rag_records)}
                    )
                    citations.extend(search_rag_records)

            current_messages.append({"role": "assistant", "content": response.content})

            current_messages.append({"role": "user", "content": tool_results})

        return output, citations


async def get_anthropic_index_response(
    model: str,
    messages: list[dict[str, Any]],
    domain: str,
) -> tuple[list[dict[str, str]], dict[str, str] | None]:
    system_prompt = build_anthropic_system_prompt(domain, ChatMode.SLACK_INDEX)

    async with AsyncAnthropic(api_key=VARIABLES.ANTHROPIC_API_KEY) as anthropic_client:
        output = []
        context_data = None

        current_messages = messages.copy()

        while True:
            response = await anthropic_client.messages.create(
                system=system_prompt,
                model=model,
                messages=current_messages,
                max_tokens=2000,
                tools=[SAVE_SLACK_CONTEXT_TOOL_ANTHROPIC],
            )

            for turn in response.content:
                if turn.type == "text":
                    output.append({"type": "text", "text": turn.text})

            tool_uses = [turn for turn in response.content if turn.type == "tool_use"]

            if not tool_uses:
                break

            tool_results = []
            for tool_use in tool_uses:
                if tool_use.name == "save_slack_context":
                    context_data = {
                        "question": tool_use.input["question"],
                        "ideal_response": tool_use.input["ideal_response"],
                    }
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use.id,
                            "content": "Context saved successfully.",
                        }
                    )

            if tool_results:
                current_messages.append({"role": "assistant", "content": response.content})
                current_messages.append({"role": "user", "content": tool_results})
            else:
                break

        return output, context_data
