from pydantic import (
    BaseModel,
    Field,
)

from fai.models.enums.language_models import LanguageModel
from fai.models.types.chat_types import ChatMessage


class PostChatCompletionRequest(BaseModel):
    model: LanguageModel | None = Field(default=None, description="The model to use for the chat completion")
    max_tokens: int | None = Field(
        default=3000,
        le=3500,
        ge=100,
        description="The maximum number of tokens to generate. "
        + "Note: setting a token count lower than 2000 may result in incomplete responses. You can add a custom "
        + "system prompt to control the verbosity of the response.",
    )
    system_prompt: str | None = Field(default=None, description="The system prompt to use for the chat completion")
    messages: list[ChatMessage] = Field(description="The messages to use for the chat completion")
    rewrite_query: bool | None = Field(
        default=False, description="Whether to rewrite the query using query decomposition"
    )
    user_is_authed: bool = Field(
        default=False,
        description="Whether the requesting user is authenticated. When true, authed chunks are included in results.",
    )
    allowed_roles: list[str] | None = Field(
        default=None,
        description="Roles the authenticated user has. Used to filter chunks by role-based access control.",
    )


class PostChatCompletionResponse(BaseModel):
    turns: list[ChatMessage] = Field(description="The conversation turns in the chat completion")
    citations: list[str] = Field(description="List of citation strings")
