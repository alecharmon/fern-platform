"""Data models for LLM interface."""

from dataclasses import (
    dataclass,
    field,
)
from enum import Enum
from typing import (
    Any,
    Literal,
)

ModelId = Literal["claude-3.7", "claude-4-sonnet", "claude-4.5-sonnet", "claude-4.5-haiku", "command-a-03-2025"]


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


@dataclass
class LLMMessage:
    role: MessageRole
    content: str | list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {"role": self.role.value, "content": self.content}


class StreamEventType(str, Enum):
    TEXT_DELTA = "text-delta"
    DATA_SOURCES = "data-sources"
    DATA_ASSISTANT_QUERY_ID = "data-assistant-query-id"
    FINISH = "finish"
    USAGE = "usage"
    ERROR = "error"
    DONE = "done"
    TOOL_CALL_START = "tool-call-start"
    TOOL_CALL_RESULT = "tool-call-result"


@dataclass
class StreamEvent:
    type: StreamEventType
    data: str | dict[str, Any] | list[Any]

    def to_sse(self) -> str:
        """Convert to SSE format: 'data: {json}\\n\\n'"""
        import json

        if self.type == StreamEventType.DONE:
            return "data: [DONE]\n\n"

        if self.type == StreamEventType.TEXT_DELTA:
            return f"data: {self.data}\n\n"

        payload = {"type": self.type.value, "data": self.data}
        return f"data: {json.dumps(payload)}\n\n"


@dataclass
class ModelConfig:
    model_id: str
    temperature: float = 0.0
    max_tokens: int = 4096
    fallback_models: list[str] = field(default_factory=list)
    provider: Literal["anthropic", "bedrock", "cohere"] | None = None
    region: str | None = None
    api_key: str | None = None


@dataclass
class LLMMetrics:
    total_time_ms: float
    input_tokens: int
    output_tokens: int
    time_to_first_token_ms: float | None = None


@dataclass
class LLMResponse:
    content: str
    model_id: str
    provider: str
    metrics: LLMMetrics
    finish_reason: str | None = None
