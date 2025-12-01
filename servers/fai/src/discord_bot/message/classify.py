from typing import Literal

from pydantic import (
    BaseModel,
    Field,
)

from discord_bot.settings import LOGGER
from fai.utils.generate_model import generate_anthropic_generic_async


class DiscordMessageClassification(BaseModel):
    classification: Literal["question", "ignore"] = Field(
        description=(
            "The classification of the message: 'question' for questions requiring a response, "
            "'ignore' for messages the bot should not respond to"
        )
    )
    reasoning: str = Field(description="Brief explanation of why this classification was chosen")


DISCORD_CLASSIFICATION_PROMPT = """You are a message classifier for a documentation chatbot in Discord. \
Your job is to determine whether incoming Discord messages should be treated as:

1. **question**: A genuine question or request for information that requires a response from the documentation bot.
2. **ignore**: Messages that don't need bot engagement, including:
   - Casual chat, greetings, thanks, social messages, or off-topic conversations
   - Questions not related to the API/service

{bot_info}

Consider the following when classifying:

- Questions often contain interrogative words (what, how, why, when, where) or request information/help
- Questions may be phrased as statements that clearly need information (e.g., "I need help with...")
- Context matters: in a thread, follow-up messages may be questions even without question marks

Message to classify:
{message_text}

Message history:

{history_context}

Classify this message and provide your reasoning."""


async def classify_message(
    text: str,
    message_history: list[dict[str, str]] | None = None,
    bot_user_id: str | None = None,
) -> Literal["question", "ignore"]:
    bot_info = ""
    if bot_user_id:
        bot_info = (
            f"**Bot Information**: The bot's Discord user ID is <@{bot_user_id}>. "
            "Any mentions to this ID are directed at the bot. Mentions to other user IDs are NOT for the bot."
        )

    history_context = ""
    if message_history and len(message_history) > 0:
        recent_messages = message_history[-3:]
        history_lines = [f"{msg['role'].upper()}: {msg['content']}" for msg in recent_messages]
        history_context = "\nRecent conversation context:\n" + "\n".join(history_lines)

    result = await generate_anthropic_generic_async(
        response_type=DiscordMessageClassification,
        prompt_template=DISCORD_CLASSIFICATION_PROMPT,
        message_text=text,
        history_context=history_context,
        bot_info=bot_info,
        model="claude-haiku-4-5-20251001",
    )

    if result is None:
        LOGGER.warning(f"Failed to classify message after retries: {text[:100]}")
        return "ignore"

    LOGGER.info(f"Discord message classification: {result.classification} - Reasoning: {result.reasoning}")

    return result.classification
