from pydantic import (
    BaseModel,
    Field,
)


class ConversationClassification(BaseModel):
    resolved: bool = Field(description=("Whether or not the user was helped with their question."))


CONVERSATION_CLASSIFICATION_PROMPT = """You are a conversation classifier for a documentation chatbot called AskFern. \
Your job is to determine whether the conversation was resolved or not. A conversation is resolved if the user was \
provided a cited response to their question. A conversation is unresolved if the assistant was unable to find any \
relevant information.

Conversation:
{conversation}

Return as boolean value indicating whether the conversation was resolved or not.
"""
