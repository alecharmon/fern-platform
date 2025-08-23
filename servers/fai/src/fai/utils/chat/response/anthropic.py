from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from typing import Tuple

from anthropic import AsyncAnthropic
from turbopuffer.types.row import Row

from src.fai.utils.chat.prompts.anthropic import build_anthropic_system_prompt
from src.fai.utils.chat.retrieve.v1_retrieve import v1_retrieve
from src.fai.utils.chat.tools import SEARCH_TOOL_ANTHROPIC
from src.settings import VARIABLES


async def get_anthropic_response(
    maybe_system_prompt: Optional[str],
    model: str,
    messages: List[Dict[str, Any]],
    domain: str,
    rag_records: List[str],
) -> Tuple[List[Dict[str, str]], List[str]]:
    async def _handle_anthropic_tool_use(tool_use: Any, domain: str) -> Tuple[str, List[str]]:
        query = tool_use.input["query"]
        query_results: List[Row] = await v1_retrieve(query, domain)
        rag_records = [result.document for result in query_results]
        return tool_use.id, rag_records

    system_prompt = (
        maybe_system_prompt if maybe_system_prompt else build_anthropic_system_prompt(domain, "\n\n".join(rag_records))
    )
    async with AsyncAnthropic(api_key=VARIABLES.ANTHROPIC_API_KEY) as anthropic_client:
        response = await anthropic_client.messages.create(
            system=system_prompt,
            model=model,
            messages=messages,
            max_tokens=1000,
            tools=[SEARCH_TOOL_ANTHROPIC],
        )

        output = []
        citations = [*rag_records]
        for turn in response.content:
            if turn.type == "text":
                output.append({"type": "text", "text": turn.text})

        tool_uses = [turn for turn in response.content if turn.type == "tool_use"]
        if tool_uses:
            tool_results = []
            for tool_use in tool_uses:
                if tool_use.name == "search":
                    tool_use_id, search_rag_records = await _handle_anthropic_tool_use(tool_use, domain)
                    tool_results.append(
                        {"type": "tool_result", "tool_use_id": tool_use_id, "content": "\n\n".join(search_rag_records)}
                    )
                    citations.extend(search_rag_records)

            messages.append({"role": "assistant", "content": response.content})

            messages.append({"role": "user", "content": tool_results})

            response = await anthropic_client.messages.create(
                system=system_prompt,
                model=model,
                messages=messages,
                max_tokens=1000,
            )

            for turn in response.content:
                if turn.type == "text":
                    output.append({"type": "text", "text": turn.text})
        return output, citations
