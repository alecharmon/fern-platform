import json
import time
import uuid

import requests

from oculus.integrations.base import AnswerMetadata, SourceMetadata

STREAM_MESSAGE_TYPE_DATA_SOURCES = "data-sources"
STREAM_MESSAGE_TYPE_ASSISTANT_QUERY_ID = "data-assistant-query-id"
STREAM_MESSAGE_TYPE_TEXT_DELTA = "text-delta"
STREAM_MESSAGE_TYPE_TOOL_CALL = "tool-call"


class VercelHTTPIntegration:
    """Integration that calls Vercel production endpoint."""

    def __init__(
        self,
        domain: str,
        model: str = "claude-4-sonnet-20250514",
        system_prompt: str | None = None,
        vercel_url: str | None = None,
    ):
        self.domain = domain
        self.model = model
        self.system_prompt = system_prompt
        self.vercel_url = vercel_url

        if not self.vercel_url:
            raise ValueError("VERCEL_URL is required for Vercel HTTP integration")

    def generate_answer(self, question: str) -> tuple[str, AnswerMetadata]:
        start_time = time.time()

        try:
            conversation_id = str(uuid.uuid4())
            query_id = str(uuid.uuid4())

            payload = {
                "url": self.vercel_url,
                "messages": [
                    {
                        "role": "user",
                        "content": question,
                        "parts": [{"type": "text", "text": question}],
                    }
                ],
                "source": "OCULUS_EVAL",
                "filters": [],
                "conversationId": conversation_id,
                "queryId": query_id,
                "documentUrls": [],
            }

            response = requests.post(
                f"{self.vercel_url}/api/fern-docs/search/v2/chat",
                headers={
                    "Content-Type": "application/json",
                    "x-fern-host": self.domain,
                },
                json=payload,
                timeout=120,
                stream=True,
            )

            response.raise_for_status()

            answer_parts: list[str] = []
            sources: list[SourceMetadata] = []
            assistant_query_id: str | None = None
            tool_call_count: int = 0

            for line in response.iter_lines():
                if not line:
                    continue

                line_str = line.decode("utf-8")

                if not line_str.strip() or line_str.startswith(":"):
                    continue

                data_str = self._parse_sse_line(line_str)
                if data_str:
                    try:
                        data = json.loads(data_str)

                        if isinstance(data, list):
                            for item in data:
                                result = self._process_stream_item(item, answer_parts, sources)
                                if result:
                                    query_id_val = result.get("query_id")
                                    if query_id_val is not None and isinstance(query_id_val, str):
                                        assistant_query_id = query_id_val
                                    tc_val = result.get("tool_calls")
                                    if tc_val is not None and isinstance(tc_val, int):
                                        tool_call_count = tc_val
                        elif isinstance(data, dict):
                            result = self._process_stream_item(data, answer_parts, sources)
                            if result:
                                query_id_val = result.get("query_id")
                                if query_id_val is not None and isinstance(query_id_val, str):
                                    assistant_query_id = query_id_val
                                tc_val = result.get("tool_calls")
                                if tc_val is not None and isinstance(tc_val, int):
                                    tool_call_count = tc_val

                    except json.JSONDecodeError:
                        continue

            answer_text = "".join(answer_parts) if answer_parts else "ERROR: No response generated"

            response_time_ms = (time.time() - start_time) * 1000
            metadata: AnswerMetadata = {
                "integration_type": "vercel-http",
                "model": self.model,
                "sources": sources,
                "response_time_ms": response_time_ms,
            }

            if assistant_query_id:
                metadata["vercel_query_id"] = assistant_query_id

            if tool_call_count > 0:
                metadata["vercel_tool_calls"] = tool_call_count

            return answer_text, metadata

        except requests.exceptions.RequestException as e:
            error_metadata_req: AnswerMetadata = {
                "integration_type": "vercel-http",
                "model": self.model,
                "sources": [],
                "response_time_ms": (time.time() - start_time) * 1000,
            }
            return f"ERROR: HTTP request failed: {str(e)}", error_metadata_req

        except Exception as e:
            error_metadata_gen: AnswerMetadata = {
                "integration_type": "vercel-http",
                "model": self.model,
                "sources": [],
                "response_time_ms": (time.time() - start_time) * 1000,
            }
            return f"ERROR: {str(e)}", error_metadata_gen

    def _parse_sse_line(self, line: str) -> str | None:
        if ":" not in line:
            return None

        # Split on first colon only
        parts = line.split(":", 1)
        if len(parts) != 2:
            return None

        data_str = parts[1].strip()
        return data_str if data_str else None

    def _process_stream_item(
        self,
        item: dict[str, object],
        answer_parts: list[str],
        sources: list[SourceMetadata],
    ) -> dict[str, str | int] | None:
        result: dict[str, str | int] = {}

        item_type = item.get("type")

        if item_type == STREAM_MESSAGE_TYPE_DATA_SOURCES:
            data_sources = item.get("data", [])
            if isinstance(data_sources, list):
                for source_obj in data_sources:
                    if isinstance(source_obj, dict):
                        sources.append(
                            {
                                "title": source_obj.get("title"),
                                "url": source_obj.get("url"),
                                "slug": None,
                            }
                        )

        elif item_type == STREAM_MESSAGE_TYPE_ASSISTANT_QUERY_ID:
            data = item.get("data")
            if isinstance(data, str):
                result["query_id"] = data

        elif item_type == STREAM_MESSAGE_TYPE_TEXT_DELTA:
            text_delta = item.get("delta", "")
            if isinstance(text_delta, str):
                answer_parts.append(text_delta)

        elif item_type == STREAM_MESSAGE_TYPE_TOOL_CALL:
            current_count = result.get("tool_calls", 0)
            if isinstance(current_count, int):
                result["tool_calls"] = current_count + 1

        return result if result else None
