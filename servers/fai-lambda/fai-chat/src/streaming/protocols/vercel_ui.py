import json
from collections.abc import AsyncGenerator
from dataclasses import asdict

from ...llm.models import (
    StreamEvent,
    StreamEventType,
)
from ...models.stream import Source
from ..protocol import StreamProtocol

START_STEP_EVENT = 'data: {"type":"start-step"}\n\n'
FINISH_STEP_EVENT = 'data: {"type":"finish-step"}\n\n'
FINISH_EVENT = 'data: {"type":"finish"}\n\n'
DONE_EVENT = "data: [DONE]\n\n"
TEXT_START_EVENT = 'data: {"type": "text-start", "id": "0"}\n\n'
TEXT_END_EVENT = 'data: {"type": "text-end", "id": "0"}\n\n'


class VercelUIMessageStreamProtocol(StreamProtocol):
    async def stream_chat(
        self,
        sources: list[Source],
        query_id: str,
        message_id: str,
        text_stream: AsyncGenerator[StreamEvent, None],
    ) -> AsyncGenerator[str, None]:
        sources_data = [asdict(source) for source in sources]
        yield f'data: {json.dumps({"type": "data-sources", "data": sources_data})}\n\n'

        yield f'data: {json.dumps({"type": "data-assistant-query-id", "data": query_id})}\n\n'

        yield f'data: {json.dumps({"type": "start", "messageId": message_id})}\n\n'

        yield START_STEP_EVENT

        yield TEXT_START_EVENT

        tool_calls_in_progress: set[str] = set()

        async for event in text_stream:
            if event.type == StreamEventType.TEXT_DELTA:
                yield f'data: {json.dumps({"type": "text-delta", "id": "0", "delta": event.data})}\n\n'

            elif event.type == StreamEventType.TOOL_CALL_START:
                if isinstance(event.data, dict):
                    tool_call_id = event.data.get("id")
                    tool_name = event.data.get("name")
                    if tool_call_id and tool_call_id not in tool_calls_in_progress:
                        tool_calls_in_progress.add(tool_call_id)
                        yield TEXT_END_EVENT
                        payload = {
                            "type": "tool-input-start",
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                        }
                        yield f"data: {json.dumps(payload)}\n\n"

            elif event.type == StreamEventType.TOOL_CALL_RESULT:
                if isinstance(event.data, dict):
                    tool_call_id = event.data.get("id")
                    tool_input = event.data.get("input")
                    tool_output = event.data.get("output")
                    tool_name = event.data.get("name")

                    if tool_call_id:
                        if tool_input:
                            input_payload = {
                                "type": "tool-input-available",
                                "toolCallId": tool_call_id,
                                "toolName": tool_name,
                                "input": tool_input,
                            }
                            yield f"data: {json.dumps(input_payload)}\n\n"
                        if tool_output is not None:
                            output_payload = {
                                "type": "tool-output-available",
                                "toolCallId": tool_call_id,
                                "output": tool_output,
                            }
                            yield f"data: {json.dumps(output_payload)}\n\n"

                        if tool_call_id in tool_calls_in_progress:
                            tool_calls_in_progress.remove(tool_call_id)
                            yield FINISH_STEP_EVENT
                            yield START_STEP_EVENT
                            yield TEXT_START_EVENT

            elif event.type == StreamEventType.USAGE:
                pass

            elif event.type == StreamEventType.ERROR:
                yield f'data: {json.dumps({"type": "error", "message": str(event.data)})}\n\n'

            elif event.type == StreamEventType.DONE:
                break

        yield TEXT_END_EVENT

        yield FINISH_STEP_EVENT

        yield FINISH_EVENT

        yield DONE_EVENT

    def get_media_type(self) -> str:
        return "text/event-stream"

    def get_headers(self) -> dict[str, str]:
        return {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
