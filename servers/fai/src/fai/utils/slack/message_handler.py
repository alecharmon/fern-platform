from dataclasses import dataclass
from typing import Any

from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select

from src.fai.db import async_session_maker
from src.fai.models.db.slack_integration_db import SlackIntegrationDb
from src.fai.models.utils.chat import ChatMode
from src.fai.utils.chat.response.anthropic import get_anthropic_response
from src.fai.utils.chat.retrieve.v2_retrieve import v2_retrieve
from src.settings import LOGGER


@dataclass
class SlackMessageContext:
    text: str
    channel: str
    thread_ts: str | None
    user: str | None
    team_id: str
    is_app_mention: bool = False


@dataclass
class SlackMessageResponse:
    response_text: str
    channel: str
    thread_ts: str | None
    bot_token: str | None


async def get_slack_integration(team_id: str) -> SlackIntegrationDb | None:
    async with async_session_maker() as session:
        result = await session.execute(
            select(SlackIntegrationDb).where(SlackIntegrationDb.slack_team_id == team_id).limit(1)
        )
        return result.scalar_one_or_none()


async def get_thread_history(
    channel: str, thread_ts: str, bot_token: str, bot_user_id: str | None = None
) -> list[dict[str, str]]:
    """Retrieve conversation history from a Slack thread."""
    try:
        client = AsyncWebClient(token=bot_token)
        result = await client.conversations_replies(channel=channel, ts=thread_ts, inclusive=True, limit=100)

        messages = []
        if result["ok"] and "messages" in result:
            for msg in result["messages"]:
                if msg.get("bot_id") or (bot_user_id and msg.get("user") == bot_user_id):
                    if msg.get("text"):
                        messages.append({"role": "assistant", "content": msg["text"]})
                else:
                    text = msg.get("text", "")
                    if bot_user_id and text:
                        text = text.replace(f"<@{bot_user_id}>", "").strip()
                    if text:
                        messages.append({"role": "user", "content": text})

        return messages
    except Exception as e:
        LOGGER.error(f"Error retrieving thread history: {e}")
        return []


async def process_message(
    text: str,
    domain: str,
    bot_user_id: str | None = None,
    message_history: list[dict[str, str]] | None = None,
    model: str = "claude-4-sonnet-20250514",
    top_k: int = 5,
) -> str:
    if bot_user_id and text:
        text = text.replace(f"<@{bot_user_id}>", "").strip()

    if not text:
        return "I need a message to respond to. Please ask me a question!"

    try:
        LOGGER.info(f"Retrieving documents for query: {text[:100]}...")
        query_results = await v2_retrieve(text, domain, top_k=top_k)
        rag_records = [
            result.chunk or result.document or "" for result in query_results if result.chunk or result.document
        ]

        LOGGER.info(f"Retrieved {len(rag_records)} documents")

        if message_history:
            messages = message_history.copy()
            if not messages or messages[-1]["content"] != text:
                messages.append({"role": "user", "content": text})
        else:
            messages = [{"role": "user", "content": text}]

        LOGGER.info(f"Processing conversation with {len(messages)} messages")

        output_turns, citations = await get_anthropic_response(
            None,
            model,
            messages,
            domain,
            rag_records,
            ChatMode.SLACK,
        )

        if output_turns and len(output_turns) > 0:
            return "\n\n".join([turn["text"] for turn in output_turns])

        return "I couldn't find any relevant information to answer your question."

    except Exception as e:
        LOGGER.error(f"Error processing message: {e}")
        return "Sorry, I encountered an error while processing your request. Please try again later."


async def handle_slack_message(
    event: dict[str, Any], team_id: str, is_app_mention: bool = False
) -> SlackMessageResponse:
    context = SlackMessageContext(
        text=event.get("text", ""),
        channel=event.get("channel", ""),
        thread_ts=event.get("thread_ts") or event.get("ts"),
        user=event.get("user"),
        team_id=team_id,
        is_app_mention=is_app_mention,
    )

    integration = await get_slack_integration(context.team_id)
    if not integration:
        LOGGER.error(f"No integration found for team {context.team_id}")
        return SlackMessageResponse("", "", None, None)

    if not integration.slack_bot_token:
        LOGGER.error(f"No bot token found for team {context.team_id}")
        return SlackMessageResponse("", "", None, None)

    LOGGER.info(f"Processing message from {context.user} in {context.channel}: {context.text[:100]}...")

    message_history = None
    if context.thread_ts and event.get("thread_ts"):
        LOGGER.info(f"Retrieving thread history for ts: {context.thread_ts}")
        message_history = await get_thread_history(
            context.channel, context.thread_ts, integration.slack_bot_token, integration.slack_bot_user_id
        )
        LOGGER.info(f"Retrieved {len(message_history)} messages from thread history")

    response_text = await process_message(
        context.text,
        integration.domain,
        integration.slack_bot_user_id if context.is_app_mention else None,
        message_history,
    )

    return SlackMessageResponse(
        response_text=response_text,
        channel=context.channel,
        thread_ts=context.thread_ts,
        bot_token=integration.slack_bot_token,
    )
