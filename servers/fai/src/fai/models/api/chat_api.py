from pydantic import (
    BaseModel,
    Field,
)

from fai.models.enums.language_models import LanguageModel
from fai.models.types.chat_types import ChatMessage


class PostChatCompletionRequest(BaseModel):
    model: LanguageModel | None = Field(default=None, description="The model to use for the chat completion")
    system_prompt: str | None = Field(default=None, description="The system prompt to use for the chat completion")
    messages: list[ChatMessage] = Field(description="The messages to use for the chat completion")


class PostChatCompletionResponse(BaseModel):
    turns: list[ChatMessage] = Field(description="The conversation turns in the chat completion")
    citations: list[str] = Field(description="List of citation strings")
