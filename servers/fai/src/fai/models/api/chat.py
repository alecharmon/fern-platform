from typing import List
from typing import Optional

from pydantic import BaseModel

from src.fai.models.types.message import ChatMessage
from src.fai.models.types.message import Citation


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    messages: List[ChatMessage]


class ChatCompletionResponse(BaseModel):
    turns: List[ChatMessage]
    citations: List[Citation]
