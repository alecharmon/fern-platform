from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from typing import Tuple

from cohere import AsyncClientV2
from turbopuffer.types.row import Row

from src.fai.utils.chat.prompts.cohere import build_cohere_system_prompt
from src.fai.utils.chat.retrieve.v1_retrieve import v1_retrieve
from src.fai.utils.chat.tools import SEARCH_TOOL_COHERE
from src.settings import LOGGER
from src.settings import VARIABLES


async def get_cohere_response(
    maybe_system_prompt: Optional[str],
    model: str,
    messages: List[Dict[str, Any]],
    domain: str,
    rag_records: List[str],
) -> Tuple[List[Dict[str, str]], List[str]]:
    async def _handle_cohere_tool_use(tool_use: Any, domain: str) -> Tuple[str, List[str]]:
        args = tool_use.function.arguments
        if isinstance(args, str):
            args = eval(args)
        query = args["query"]
        query_results: List[Row] = await v1_retrieve(query, domain)
        return tool_use.id, [result.document for result in query_results]

    def _build_system_turn(system_prompt: str) -> Dict[str, str]:
        return {"role": "system", "content": system_prompt}

    def _to_str_content(content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text" and "text" in item:
                        parts.append(str(item["text"]))
                    elif item.get("type") == "tool_result" and "content" in item:
                        parts.append(str(item["content"]))
                else:
                    parts.append(str(item))
            return "\n".join(parts).strip()
        return str(content)

    def _normalize_messages_for_cohere(system_prompt: str, msgs: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        allowed = {"user", "assistant", "system", "tool"}
        out = [_build_system_turn(system_prompt)]
        for m in msgs:
            role = m.get("role", "user")
            if role not in allowed:
                continue
            if role == "system":
                continue
            out.append({"role": role, "content": _to_str_content(m.get("content", ""))})
        return out

    def _collect_text_parts_from_cohere(resp_obj: Any) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        for part in resp_obj.message.content:
            if part.type == "text":
                out.append({"type": "text", "text": part.text})
        return out

    system_prompt = maybe_system_prompt if maybe_system_prompt else build_cohere_system_prompt("\n\n".join(rag_records))
    async with AsyncClientV2(api_key=VARIABLES.COHERE_API_KEY) as cohere_client:
        cohere_messages = _normalize_messages_for_cohere(system_prompt, messages)
        resp = await cohere_client.chat(
            model=model,
            messages=cohere_messages,
            max_tokens=1000,
            temperature=0.2,
            tools=[SEARCH_TOOL_COHERE],
        )

        tool_call_message = resp.message
        tool_calls = tool_call_message.tool_calls

        if tool_calls and len(tool_calls) > 0:
            first_tool_call = tool_calls[0]
            if first_tool_call.function.name == "search":
                tool_use_id, search_rag_records = await _handle_cohere_tool_use(first_tool_call, domain)
                tool_response_content = [
                    {"type": "document", "document": {"data": result}} for result in search_rag_records
                ]
                followup_messages = [
                    *messages,
                    tool_call_message,
                    {"role": "tool", "tool_call_id": tool_use_id, "content": tool_response_content},
                ]
                resp2 = await cohere_client.chat(
                    model=model,
                    messages=followup_messages,
                    max_tokens=1000,
                    temperature=0.2,
                )

                return _collect_text_parts_from_cohere(resp2), [*rag_records, *search_rag_records]

        return _collect_text_parts_from_cohere(resp), rag_records
