from typing import (
    Any,
    Literal,
)

from fai_ai_core.models.chat import ChatMessage
from pydantic import (
    BaseModel,
    Field,
)

__all__ = ["TextPart", "MessagePart", "UIMessage", "ChatMessage", "FacetFilter", "ChatRequest"]


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


class FacetFilter(BaseModel):
    model_config = {"extra": "ignore", "populate_by_name": True}
    field: str = Field(..., alias="facet")
    value: Any


class ChatRequest(BaseModel):
    model_config = {"extra": "ignore", "populate_by_name": True}
    messages: list[UIMessage] = Field(..., min_length=1)
    source: str | None = None
    filters: list[FacetFilter] = Field(default_factory=list)
    conversationId: str | None = Field(default=None, alias="conversationId")
    queryId: str | None = Field(default=None, alias="queryId")
    documentUrls: list[str] = Field(default_factory=list, alias="documentUrls")
    skipSaveQuery: bool = Field(default=False, alias="skipSaveQuery")
    model: str | None = None
    customerSystemPrompt: str | None = Field(default=None, alias="customerSystemPrompt")
    rewriteQuery: bool = Field(default=False, alias="rewriteQuery")

    def get_simple_messages(self) -> list[ChatMessage]:
        # Extract only text parts from UI messages. Non-text parts (step-start, data-sources,
        # tool-invocation, etc.) are UI metadata and shouldn't be sent to the LLM.
        # Empty messages are filtered and consecutive same-role messages are merged because
        # Bedrock fails with "The text field in the ContentBlock object is blank" for empty
        # content, and requires valid user/assistant alternation.
        simple_messages: list[ChatMessage] = []
        for msg in self.messages:
            content_parts = []
            for part in msg.parts:
                if part.type == "text" and part.text:
                    content_parts.append(part.text)
            content = "".join(content_parts)
            if not content:
                continue
            if simple_messages and simple_messages[-1].role == msg.role:
                simple_messages[-1] = ChatMessage(
                    role=msg.role,
                    content=simple_messages[-1].content + "\n\n" + content,
                )
            else:
                simple_messages.append(ChatMessage(role=msg.role, content=content))
        return simple_messages
