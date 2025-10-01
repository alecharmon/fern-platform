from pydantic import (
    BaseModel,
    Field,
)

from fai.models.types.conversation_types import Conversation


class GetConversationResponse(BaseModel):
    conversation: Conversation = Field(description="The complete conversation with all turns")
