from dataclasses import dataclass
from datetime import (
    UTC,
    datetime,
    timedelta,
)
from uuid import uuid4

import discord
from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.dialects.postgresql import insert

from src.apps.discord.utils.channel import ChannelSettings
from src.apps.discord.utils.integration import get_discord_integration
from src.fai.db import async_session_maker
from src.fai.models.db.discord_message_cache_db import DiscordMessageCacheDb
from src.fai.models.db.query_db import QueryDb
from src.fai.models.utils.chat import ChatMode
from src.fai.utils.chat.response.anthropic import get_anthropic_response
from src.fai.utils.chat.retrieve.retrieve import retrieve
from src.settings import LOGGER

DISCORD_FOLLOW_UP_MESSAGE = """\
---
_If you have follow-up questions, please @Ask Fern again in this thread._\
"""

MESSAGE_CACHE_TTL = 30


@dataclass
class DiscordMessageResponse:
    response_text: str
    channel: str
    query_id: str | None = None
    user_id: str | None = None


async def cleanup_message_cache() -> None:
    cutoff_time = datetime.now(UTC) - timedelta(seconds=MESSAGE_CACHE_TTL)

    async with async_session_maker() as session:
        await session.execute(delete(DiscordMessageCacheDb).where(DiscordMessageCacheDb.processed_at < cutoff_time))
        await session.commit()


async def is_message_processed(team_id: str, message_ts: str) -> bool:
    async with async_session_maker() as session:
        result = await session.execute(
            select(DiscordMessageCacheDb).where(
                DiscordMessageCacheDb.discord_guild_id == team_id, DiscordMessageCacheDb.message_id == message_ts
            )
        )
        return result.scalar_one_or_none() is not None


async def mark_message_processed(team_id: str, message_ts: str) -> None:
    async with async_session_maker() as session:
        stmt = insert(DiscordMessageCacheDb).values(
            id=str(uuid4()), message_id=message_ts, discord_guild_id=team_id, processed_at=datetime.now(UTC)
        )
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["discord_guild_id", "message_id"]  # Use column names instead
        )
        await session.execute(stmt)
        await session.commit()


async def get_thread_history(channel: discord.Thread) -> list[dict[str, str]]:
    return []


async def handle_discord_message(message: discord.Message) -> DiscordMessageResponse:
    if message.guild is None:
        return DiscordMessageResponse("", "", None, None)

    await cleanup_message_cache()

    is_processed = await is_message_processed(str(message.guild.id), str(message.id))
    if is_processed:
        return DiscordMessageResponse("", "", None, None)

    await mark_message_processed(str(message.guild.id), str(message.id))

    integration = await get_discord_integration(str(message.guild.id))

    if not integration:
        return DiscordMessageResponse("", "", None, None)

    if not integration.discord_guild_id:
        return DiscordMessageResponse("", "", None, None)

    channel_settings = None
    domain_to_use = integration.domain
    is_in_thread = isinstance(message.channel, discord.Thread)

    if integration.settings and isinstance(integration.settings, dict):
        channel_config = integration.settings.get(
            str(message.channel.parent_id) if is_in_thread else str(message.channel.id), {}
        )
        if channel_config:
            channel_settings = ChannelSettings(**channel_config)
            if channel_settings.domain_override:
                domain_to_use = channel_settings.domain_override
                LOGGER.info(f"Using domain override for channel {message.channel.id}: {domain_to_use}")

    should_respond = await should_respond_to_message(channel_settings, message, is_in_thread)
    if not should_respond:
        return DiscordMessageResponse("", "", None, None)

    async with message.channel.typing():
        await message.add_reaction("👀")
        print(f"Processing message from {message.author} in {message.channel.id}...")

        message_history = None
        if is_in_thread:
            message_history = await get_thread_history(message.channel)

        conversation_id = f"discord_{message.guild.id}_{message.channel.id}_{message.id}"

        response_text, query_id = await process_message(
            message.content,
            domain_to_use,
            message.guild.me.id if is_bot_mentioned(message) else None,
            message_history,
            conversation_id=conversation_id,
        )
        if response_text and len(response_text) > 0:
            try:
                chunks = [response_text[i : i + 2000] for i in range(0, len(response_text), 2000)]

                if isinstance(message.channel, discord.Thread):
                    for chunk in chunks:
                        await message.channel.send(chunk)
                else:
                    if hasattr(message, "thread") and message.thread:
                        for chunk in chunks:
                            await message.thread.send(chunk)
                    else:
                        thread = await message.create_thread(
                            name=f"Discussion: {message.content.replace(f'<@{message.guild.me.id}>', '').strip()[:100]}"
                        )
                        for chunk in chunks:
                            await thread.send(chunk)

            except discord.HTTPException as e:
                LOGGER.error(f"Failed to send message: {e}")

        await message.remove_reaction("👀", message.guild.me)
        await message.add_reaction("✅")

        return DiscordMessageResponse(response_text, message.channel.id, query_id, message.author.id)


async def should_respond_to_message(
    channel_settings: ChannelSettings | None, message: discord.Message, is_in_thread: bool
) -> bool:
    if channel_settings is None:
        return False

    if not is_in_thread:
        if channel_settings.channel_response == "all_messages":
            return True
        elif channel_settings.channel_response == "mentions_only":
            return message.guild.me in message.mentions
        return False
    else:
        if channel_settings.thread_response == "all_messages":
            try:
                if message.guild.me in message.mentions:
                    return True

                thread_channel = message.channel
                if hasattr(thread_channel, "starter_message") and thread_channel.starter_message:
                    starter_message = thread_channel.starter_message
                    return is_bot_mentioned(starter_message)
                async for msg in thread_channel.history(limit=1, oldest_first=True):
                    return is_bot_mentioned(msg)
                return False
            except Exception:
                return False
        elif channel_settings.thread_response == "mentions_only":
            if is_bot_mentioned(message):
                return True
            return False
        return False


def is_bot_mentioned(message: discord.Message) -> bool:
    if message.guild.me in message.mentions:
        return True
    for role in message.role_mentions:
        if role.name == "Ask Fern":
            return True
    return False


async def log_query_to_db(
    query_text: str,
    domain: str,
    conversation_id: str,
    role: str = "USER",
    source: str = "DISCORD",
) -> str | None:
    try:
        async with async_session_maker() as session:
            db_query = QueryDb(
                query_id=str(uuid4()),
                conversation_id=conversation_id,
                domain=domain,
                text=query_text,
                role=role,
                source=source,
                created_at=datetime.now(UTC),
                time_to_first_token=None,
            )
            session.add(db_query)
            await session.commit()
            LOGGER.info(f"Logged Discord query to database: {db_query.query_id}")
            return db_query.query_id
    except Exception as e:
        LOGGER.error(f"Failed to log query to database: {e}")
        return None


async def process_message(
    text: str,
    domain: str,
    bot_user_id: str | None = None,
    message_history: list[dict[str, str]] | None = None,
    model: str = "claude-4-sonnet-20250514",
    top_k: int = 5,
    conversation_id: str | None = None,
) -> tuple[str, str | None]:
    if bot_user_id and text:
        text = text.replace(f"<@{bot_user_id}>", "").strip()

    if not text:
        return "I need a message to respond to. Please ask me a question!", None

    query_id = None
    if conversation_id:
        query_id = await log_query_to_db(text, domain, conversation_id, role="USER", source="DISCORD")

    try:
        LOGGER.info(f"Retrieving documents for query: {text[:100]}...")
        query_results = await retrieve(text, domain, top_k=top_k)
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
            ChatMode.DISCORD,
        )

        if output_turns and len(output_turns) > 0:
            response = "\n\n".join([turn["text"] for turn in output_turns])
            response = f"{response}\n\n{DISCORD_FOLLOW_UP_MESSAGE}"
            if conversation_id:
                await log_query_to_db(response, domain, conversation_id, role="ASSISTANT", source="DISCORD")
            return response, query_id

        return "I couldn't find any relevant information to answer your question.", query_id

    except Exception as e:
        LOGGER.error(f"Error processing message: {e}")
        return "Sorry, I encountered an error while processing your request. Please try again later.", query_id
