import json
import logging
from collections.abc import AsyncGenerator
from dataclasses import asdict

from fai_ai_core.llm.models import (
    StreamEvent,
    StreamEventType,
)

from ...models.stream import Source
from ..protocol import StreamProtocol

logger = logging.getLogger(__name__)

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
        logger.info(f"[hanging-thread] stream_chat begin query_id={query_id}")
        sources_data = [asdict(source) for source in sources]
        yield f'data: {json.dumps({"type": "data-sources", "data": sources_data})}\n\n'

        yield f'data: {json.dumps({"type": "data-assistant-query-id", "data": query_id})}\n\n'

        yield f'data: {json.dumps({"type": "start", "messageId": message_id})}\n\n'

        yield START_STEP_EVENT

        yield TEXT_START_EVENT

        logger.info(f"[hanging-thread] stream_chat entering text_stream loop query_id={query_id}")
        async for event in text_stream:
            if event.type == StreamEventType.TEXT_DELTA:
                yield f'data: {json.dumps({"type": "text-delta", "id": "0", "delta": event.data})}\n\n'

            elif event.type in (StreamEventType.TOOL_CALL_START, StreamEventType.TOOL_CALL_RESULT):
                pass

            elif event.type == StreamEventType.USAGE:
                pass

            elif event.type == StreamEventType.ERROR:
                yield f'data: {json.dumps({"type": "error", "message": str(event.data)})}\n\n'

            elif event.type == StreamEventType.DONE:
                logger.info(f"[hanging-thread] stream_chat received DONE event query_id={query_id}")
                break

        logger.info(f"[hanging-thread] stream_chat text_stream loop exited query_id={query_id}")
        yield TEXT_END_EVENT

        yield FINISH_STEP_EVENT

        yield FINISH_EVENT

        yield DONE_EVENT
        logger.info(f"[hanging-thread] stream_chat yielded all closing events query_id={query_id}")

    def get_media_type(self) -> str:
        return "text/event-stream"

    def get_headers(self) -> dict[str, str]:
        return {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1",
        }
