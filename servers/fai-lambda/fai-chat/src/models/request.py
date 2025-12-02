from typing import (
    Any,
    Literal,
)

from pydantic import (
    BaseModel,
    Field,
)


class TextPart(BaseModel):
    type: Literal["text"]
    text: str


class MessagePart(BaseModel):
    model_config = {"extra": "ignore"}
    type: str
    text: str | None = None


class UIMessage(BaseModel):
    model_config = {"extra": "ignore"}
    role: Literal["user", "assistant"]
    parts: list[MessagePart]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class FacetFilter(BaseModel):
    field: str
    value: Any


class ChatRequest(BaseModel):
    messages: list[UIMessage] = Field(..., min_length=1)
    source: str | None = None
    filters: list[FacetFilter] = Field(default_factory=list)
    conversationId: str | None = Field(default=None, alias="conversationId")
    queryId: str | None = Field(default=None, alias="queryId")
    documentUrls: list[str] = Field(default_factory=list, alias="documentUrls")
    skipSaveQuery: bool = Field(default=False, alias="skipSaveQuery")

    def get_simple_messages(self) -> list[ChatMessage]:
        simple_messages = []
        for msg in self.messages:
            content_parts = []
            for part in msg.parts:
                if part.type == "text" and part.text:
                    content_parts.append(part.text)
            content = "".join(content_parts)
            simple_messages.append(ChatMessage(role=msg.role, content=content))
        return simple_messages
