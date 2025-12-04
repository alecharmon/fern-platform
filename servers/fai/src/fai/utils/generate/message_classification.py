from typing import Literal

from pydantic import (
    BaseModel,
    Field,
)


class MessageClassification(BaseModel):
    classification: Literal["question", "index", "ignore"] = Field(
        description=(
            "The classification of the message: 'question' for questions requiring a response, "
            "'index' for messages that request the bot to index a thread to improve its responses, "
            "'ignore' for casual chat/greetings"
        )
    )
    reasoning: str = Field(description="Brief explanation of why this classification was chosen")


class MessageClassificationMentionsOnly(BaseModel):
    classification: Literal["question", "index"] = Field(
        description=(
            "The classification of the message: 'question' for questions requiring a response, "
            "'index' for messages that request the bot to index a thread to improve its responses"
        )
    )
    reasoning: str = Field(description="Brief explanation of why this classification was chosen")


CLASSIFICATION_PROMPT = """You are a message classifier for a documentation chatbot called AskFern. \
Your job is to determine whether incoming Slack messages should be treated as:

1. **question**: A genuine question or request for information that requires a detailed response \
from the documentation bot. You should not classify questions that are not related to the API / service as questions.
2. **index**: A message that requests the bot to index a thread to improve its responses. This should only be \
returned if the conversation thread can improve the bot's responses.
3. **ignore**: Casual chat, greetings, thanks, social messages, or off-topic conversations that \
don't need bot engagement. This will be used to ignore messages that are not related to the API / service.

{bot_info}

Consider the following when classifying:

- Questions often contain interrogative words (what, how, why, when, where) or request information/help
- Questions may be phrased as statements that clearly need information (e.g., "I need help with...")
- Feedback includes things like "this doesn't work", "great response", "the bot should...", "I found a bug"
- Ignore casual messages like "hello", "thanks", "lol", "have a good day", or general conversation between humans
- **IMPORTANT**: If a message is clearly addressed to a specific person (e.g., contains @username or "hey John"), \
classify it as "ignore" since it's a conversation between humans, not intended for the bot
- **IMPORTANT**: If a question is directed at a specific person (not the bot), classify it as "ignore"
- **IMPORTANT**: Check Slack mentions carefully - if the message starts with mentions to other users (not the bot), \
it's likely directed at them, not the bot
- Context matters: in a thread, follow-up messages may be questions even without question marks

Message to classify:
{message_text}

{history_context}

Classify this message and provide your reasoning."""


CLASSIFICATION_PROMPT_MENTIONS_ONLY = """You are a message classifier for a documentation chatbot called AskFern. \
The bot has been directly mentioned, so you must respond. Your job is to determine whether the message should \
be treated as:

1. **question**: A genuine question or request for information that requires a detailed response from the \
documentation bot. This is the default classification when the bot is mentioned.
2. **index**: A message that explicitly requests the bot to index a thread to improve its responses. This should \
only be returned if the user is clearly asking to save/index conversation context for future reference.

{bot_info}

Consider the following when classifying:

- Most mentions are questions - if in doubt, classify as "question"
- Questions often contain interrogative words (what, how, why, when, where) or request information/help
- Questions may be phrased as statements that clearly need information (e.g., "I need help with...")
- **index** should only be used when explicitly requested (e.g., "please index this thread", \
"remember this conversation", "save this for future reference")
- Even casual messages like greetings when the bot is mentioned should be treated as "question" since the user \
explicitly invoked the bot
- Context matters: in a thread, follow-up messages may be questions even without question marks

Message to classify:
{message_text}

{history_context}

Classify this message and provide your reasoning."""
