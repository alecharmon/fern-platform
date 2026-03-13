import re
from dataclasses import dataclass
from datetime import (
    UTC,
    datetime,
    timedelta,
)
from urllib.parse import urlparse
from uuid import uuid4

import discord
from fai_ai_core.llm.factory import get_llm_provider
from fai_ai_core.llm.models import LLMMessage, MessageRole
from fai_ai_core.prompts.system import ChatMode, build_system_prompt, format_retrieved_docs
from fai_ai_core.retrieval.factory import get_retriever
from fai_ai_core.retrieval.interface import (
    RetrievalQuery,
    RetrievalStrategy,
    RetrievedDocument,
)
from fai_ai_core.retrieval.query_decomposition import decompose_query
from fai_ai_core.retrieval.utils import deduplicate_documents, extract_citations, format_citations
from fai_ai_core.tools.documentation_search import create_documentation_search_tool
from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.dialects.postgresql import insert

from discord_bot.db import async_session_maker
from discord_bot.message.classify import classify_message
from discord_bot.settings import LOGGER
from fai.credits.client import get_credit_client
from fai.credits.config import is_credit_gated
from fai.models.db.discord_message_cache_db import DiscordMessageCacheDb
from fai.models.db.query_db import QueryDb
from fai.models.types.channel_settings_type import DiscordChannelSettings
from fai.utils.integration import get_discord_integration

MESSAGE_CACHE_TTL = 30


def generate_title_from_url(url: str) -> str:
    """Generate a fallback title from a URL path."""
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.strip("/").split("/") if p]
    relevant_parts = path_parts[-2:] if len(path_parts) > 2 else path_parts
    formatted_parts = [part.replace("-", " ").replace("_", " ").title() for part in relevant_parts]
    return " | ".join(formatted_parts) if formatted_parts else parsed.netloc


def extract_citation_info_from_citations(citations: list[str], docs: list[RetrievedDocument]) -> dict[str, str]:
    url_to_title: dict[str, str] = {}
    for doc in docs:
        if doc.metadata:
            url = doc.metadata.get("url")
            title = doc.metadata.get("title")
            if url and title:
                url_to_title[url] = title

    results: dict[str, str] = {}
    for citation in citations:
        match = re.search(r"Source:\s*(https?://[^\s]+)", citation)
        if match:
            url = match.group(1)
            if url not in results:
                title = url_to_title.get(url)
                if not title or len(title.strip()) < 3:
                    title = generate_title_from_url(url)
                results[url] = title

    return results


def deduplicate_citations(text: str) -> tuple[str, dict[int, str]]:
    """
    Remove duplicate citation numbers from text, keeping only the first occurrence.
    Handles citations in the format [(1)](url) for Discord.
    Preserves content inside code blocks (inline ` and multiline ```).
    Returns the cleaned text and a dict mapping citation numbers to their URLs.
    """
    code_blocks: list[str] = []
    placeholder_template = "___CODE_BLOCK_{}_____"

    def save_code_block(match: re.Match[str]) -> str:
        index = len(code_blocks)
        code_blocks.append(match.group(0))
        return placeholder_template.format(index)

    text = re.sub(r"```[\s\S]*?```", save_code_block, text)
    text = re.sub(r"`[^`]+`", save_code_block, text)

    seen_citations = {}
    citation_to_url = {}

    def replace_citation(match: re.Match[str]) -> str:
        citation_num = int(match.group(1))
        url = match.group(2)

        citation_key = (citation_num, url)
        if citation_key in seen_citations:
            return ""

        seen_citations[citation_key] = True
        citation_to_url[citation_num] = url
        return match.group(0)

    text = re.sub(r"\[\((\d+)\)\]\(([^)]+)\)", replace_citation, text)

    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r"\s+([.,;:!?)])", r"\1", text)

    for index, code_block in enumerate(code_blocks):
        text = text.replace(placeholder_template.format(index), code_block)

    return text, citation_to_url


class FeedbackView(discord.ui.View):
    def __init__(self, help_role_id: str | None = None) -> None:
        super().__init__(timeout=None)
        self.help_role_id = help_role_id

    @discord.ui.button(label="Mark as resolved ✅", style=discord.ButtonStyle.secondary, custom_id="mark_resolved")
    async def mark_resolved(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        try:
            await interaction.response.send_message("Marked as resolved!", ephemeral=True)
            button.label = "Marked as resolved"
            button.disabled = True
            await interaction.message.edit(view=self)

            if isinstance(interaction.channel, discord.Thread):
                current_name = interaction.channel.name
                if not current_name.startswith("[RESOLVED]"):
                    new_name = current_name.replace("Discussion: ", "[RESOLVED] ", 1)
                    await interaction.channel.edit(name=new_name)
                    LOGGER.info(f"Renamed thread to: {new_name}")

                try:
                    if isinstance(interaction.channel.parent, discord.TextChannel):
                        starter_msg = await interaction.channel.parent.fetch_message(interaction.channel.id)
                        await starter_msg.remove_reaction("💬", interaction.guild.me)
                        await starter_msg.add_reaction("✅")
                        LOGGER.info("Removed speech bubble and added checkmark reaction to starter message")
                except Exception as e:
                    LOGGER.warning(f"Could not update reactions on starter message: {e}")

        except Exception as e:
            LOGGER.error(f"Error in mark_resolved: {e}")
            if not interaction.response.is_done():
                await interaction.response.send_message("Marked as resolved!", ephemeral=True)

    @discord.ui.button(label="Ask for help 👋", style=discord.ButtonStyle.secondary, custom_id="ask_help")
    async def ask_help(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        if self.help_role_id:
            try:
                role = interaction.guild.get_role(int(self.help_role_id))
                if role:
                    await interaction.response.send_message(
                        f"Looping in {role.mention} for additional help.", suppress_embeds=True
                    )
                    return

                member = interaction.guild.get_member(int(self.help_role_id))
                if member:
                    await interaction.response.send_message(
                        f"Looping in {member.mention} for additional help.", suppress_embeds=True
                    )
                    return

                LOGGER.warning(f"Could not find role or member with ID: {self.help_role_id}")
                await interaction.response.send_message(
                    "Feel free to tag @Ask AI with additional questions.", ephemeral=True
                )
            except Exception as e:
                LOGGER.error(f"Error in ask_help: {e}")
                await interaction.response.send_message(
                    "Feel free to tag @Ask AI with additional questions.", ephemeral=True
                )
        else:
            LOGGER.info("No help_role_id configured")
            await interaction.response.send_message(
                "Feel free to tag @Ask AI with additional questions.", ephemeral=True
            )


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


async def is_message_processed(team_id: str, message_id: str) -> bool:
    async with async_session_maker() as session:
        result = await session.execute(
            select(DiscordMessageCacheDb).where(
                DiscordMessageCacheDb.discord_guild_id == team_id, DiscordMessageCacheDb.message_id == message_id
            )
        )
        return result.scalar_one_or_none() is not None


async def mark_message_processed(team_id: str, message_id: str) -> None:
    async with async_session_maker() as session:
        stmt = insert(DiscordMessageCacheDb).values(
            id=str(uuid4()), message_id=message_id, discord_guild_id=team_id, processed_at=datetime.now(UTC)
        )
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["discord_guild_id", "message_id"]  # Use column names instead
        )
        await session.execute(stmt)
        await session.commit()


async def get_thread_history(channel: discord.Thread, bot_user_id: str | None = None) -> list[dict[str, str]]:
    try:
        messages = []
        starter_msg = None

        try:
            if isinstance(channel.parent, discord.TextChannel):
                starter_msg = await channel.parent.fetch_message(channel.id)
                LOGGER.info(f"Fetched starter message: {starter_msg.content}")
        except Exception as e:
            LOGGER.warning(f"Could not fetch starter message: {e}")

        if starter_msg:
            LOGGER.info(f"Adding starter message from {starter_msg.author.name}: {starter_msg.content}")
            if starter_msg.author.bot and str(starter_msg.author.id) == bot_user_id:
                if starter_msg.content:
                    messages.append({"role": "assistant", "content": starter_msg.content})
            else:
                text = starter_msg.content
                if bot_user_id and text:
                    text = text.replace(f"<@{bot_user_id}>", "").strip()
                if text:
                    messages.append({"role": "user", "content": text})

        # Get all replies in the thread
        async for msg in channel.history(limit=100, oldest_first=True):
            if msg.author.bot and str(msg.author.id) == bot_user_id:
                if msg.content:
                    messages.append({"role": "assistant", "content": msg.content})
            else:
                text = msg.content
                if bot_user_id and text:
                    text = text.replace(f"<@{bot_user_id}>", "").strip()
                if text:
                    messages.append({"role": "user", "content": text})

        return messages
    except Exception as e:
        LOGGER.error(f"Error retrieving thread history: {e}")
        return []


async def handle_discord_message(message: discord.Message) -> None:
    if message.guild is None:
        return

    await cleanup_message_cache()

    is_processed = await is_message_processed(str(message.guild.id), str(message.id))
    if is_processed:
        return

    await mark_message_processed(str(message.guild.id), str(message.id))

    integration = await get_discord_integration(str(message.guild.id))

    if not integration:
        return

    if not integration.discord_guild_id:
        return

    channel_settings = None
    domain_to_use = integration.domain
    is_in_thread = isinstance(message.channel, discord.Thread)

    if integration.settings and isinstance(integration.settings, dict):
        channel_config = integration.settings.get(
            str(message.channel.parent_id) if is_in_thread else str(message.channel.id), {}
        )
        if channel_config:
            channel_settings = DiscordChannelSettings(**channel_config)
            if channel_settings.domain_override:
                domain_to_use = channel_settings.domain_override
                LOGGER.info(f"Using domain override for channel {message.channel.id}: {domain_to_use}")

    if channel_settings is None:
        return

    message_history = None
    if is_in_thread:
        message_history = await get_thread_history(message.channel, str(message.guild.me.id))
        LOGGER.info(f"Retrieved {len(message_history)} messages from thread history")

    should_respond = await should_respond_to_message(channel_settings, message, is_in_thread, message_history)
    if not should_respond:
        return

    async with message.channel.typing():
        await message.add_reaction("👀")
        LOGGER.info(f"Processing message from {message.author} in {message.channel.id}...")

        conversation_id = f"discord_{message.guild.id}_{message.channel.id}_{message.id}"

        response_text, query_id, sources_text = await process_message(
            message.content,
            domain_to_use,
            str(message.guild.me.id) if is_bot_mentioned(message) else None,
            message_history,
            conversation_id=conversation_id,
        )
        if response_text and len(response_text) > 0:
            try:
                await message.remove_reaction("👀", message.guild.me)

                chunks = [response_text[i : i + 2000] for i in range(0, len(response_text), 2000)]
                help_role_id = channel_settings.help_role_id if channel_settings else None
                view = FeedbackView(help_role_id=help_role_id)

                target_channel = None
                reaction_target = None

                if isinstance(message.channel, discord.Thread):
                    target_channel = message.channel
                    try:
                        if isinstance(message.channel.parent, discord.TextChannel):
                            reaction_target = await message.channel.parent.fetch_message(message.channel.id)
                    except Exception as e:
                        LOGGER.warning(f"Could not fetch starter message: {e}")
                elif hasattr(message, "thread") and message.thread:
                    target_channel = message.thread
                    reaction_target = message
                else:
                    thread_content = message.content.replace(f"<@{message.guild.me.id}>", "").strip()
                    if not thread_content:
                        thread_name = "Discussion"
                    else:
                        max_content_length = 85
                        if len(thread_content) > max_content_length:
                            thread_name = f"Discussion: {thread_content[:max_content_length]}..."
                        else:
                            thread_name = f"Discussion: {thread_content}"

                    target_channel = await message.create_thread(name=thread_name)
                    reaction_target = message

                for chunk in chunks:
                    await target_channel.send(chunk, mention_author=True, suppress_embeds=True)

                if sources_text:
                    await target_channel.send(sources_text, mention_author=False, suppress_embeds=True)

                await target_channel.send("\u200b", view=view)

                if reaction_target:
                    try:
                        await reaction_target.add_reaction("💬")
                        LOGGER.info("Added speech bubble reaction")
                    except Exception as e:
                        LOGGER.warning(f"Could not add speech bubble reaction: {e}")

            except discord.HTTPException as e:
                LOGGER.error(f"Failed to send message: {e}")


async def should_respond_to_message(
    channel_settings: DiscordChannelSettings,
    message: discord.Message,
    is_in_thread: bool,
    message_history: list[dict[str, str]] | None = None,
) -> bool:
    bot_mentioned = is_bot_mentioned(message)
    other_members_mentioned = has_other_member_mentions(message)

    if other_members_mentioned and not bot_mentioned:
        LOGGER.info("Other members mentioned, not responding")
        return False

    response_mode = channel_settings.channel_response

    if response_mode == "mentions_only":
        if is_in_thread:
            if bot_mentioned:
                return True
            try:
                thread_channel = message.channel
                if hasattr(thread_channel, "starter_message") and thread_channel.starter_message:
                    starter_message = thread_channel.starter_message
                    return is_bot_mentioned(starter_message)
                async for msg in thread_channel.history(limit=1, oldest_first=True):
                    return is_bot_mentioned(msg)
                return False
            except Exception:
                return False
        else:
            return bot_mentioned
    elif response_mode == "auto":
        if bot_mentioned:
            return True

        classification = await classify_message(message.content, message_history, str(message.guild.me.id))

        LOGGER.info(f"Auto mode classification: {classification}")
        return classification == "question"

    return False


def is_bot_mentioned(message: discord.Message) -> bool:
    if message.guild.me in message.mentions:
        return True
    for role in message.role_mentions:
        if role.name == "Ask Fern":
            return True
    return False


def has_other_member_mentions(message: discord.Message) -> bool:
    for mention in message.mentions:
        if mention.id != message.guild.me.id:
            return True
    return False


async def log_query_to_db(
    query_text: str,
    domain: str,
    conversation_id: str,
    role: str = "USER",
    source: str = "DISCORD",
    subqueries: list[str] | None = None,
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
                subqueries=subqueries,
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
    model: str = "claude-4-sonnet",
    top_k: int = 5,
    conversation_id: str | None = None,
    rewrite_query_enabled: bool = True,
) -> tuple[str, str | None, str | None]:
    if bot_user_id and text:
        text = text.replace(f"<@{bot_user_id}>", "").strip()

    if not text:
        return "I need a message to respond to. Please ask me a question!", None, None

    try:
        LOGGER.info(f"Retrieving documents for query: {text[:100]}...")

        retriever = get_retriever()
        retrieved_documents: list[RetrievedDocument] = []
        subqueries: list[str] | None = None

        if rewrite_query_enabled:
            LOGGER.info(f"Query rewriting enabled for domain {domain}")
            subqueries = await decompose_query(text)
            LOGGER.info(f"Decomposed query into {len(subqueries)} sub-queries")
            for index, sub_query in enumerate(subqueries):
                LOGGER.info(f"Subquery {index + 1}: {sub_query}")

            retrieval_queries = [
                RetrievalQuery(query=sq, domain=domain, strategy=RetrievalStrategy.HYBRID, top_k=top_k)
                for sq in subqueries
            ]
            results = await retriever.batch_retrieve(retrieval_queries)
            all_docs = [doc for result in results for doc in result.documents]
            retrieved_documents = deduplicate_documents([all_docs])
        else:
            retrieval_query = RetrievalQuery(query=text, domain=domain, strategy=RetrievalStrategy.HYBRID, top_k=top_k)
            result = await retriever.retrieve(retrieval_query)
            retrieved_documents = result.documents

        query_id = None
        if conversation_id:
            query_id = await log_query_to_db(
                text,
                domain,
                conversation_id,
                role="USER",
                source="DISCORD",
                subqueries=subqueries,
            )

        LOGGER.info(f"Retrieved {len(retrieved_documents)} documents")

        if message_history:
            messages = message_history.copy()
            if not messages or messages[-1]["content"] != text:
                messages.append({"role": "user", "content": text})
        else:
            messages = [{"role": "user", "content": text}]

        LOGGER.info(f"Processing conversation with {len(messages)} messages")

        formatted_docs = format_retrieved_docs(retrieved_documents, domain)
        system_prompt = build_system_prompt(domain, ChatMode.DISCORD, formatted_docs)

        llm_messages = [LLMMessage(role=MessageRole.SYSTEM, content=system_prompt)]
        for msg in messages:
            role = MessageRole.ASSISTANT if msg["role"] == "assistant" else MessageRole.USER
            llm_messages.append(LLMMessage(role=role, content=msg["content"]))

        initial_urls: set[str] = set()
        for doc in retrieved_documents:
            if doc.metadata:
                url = doc.metadata.get("url")
                if url:
                    initial_urls.add(url)

        search_tool = create_documentation_search_tool(
            retriever=retriever,
            domain=domain,
            top_k=top_k,
            max_calls=2,
            already_retrieved_urls=initial_urls,
        )

        credit_client = get_credit_client()
        credit_gated = False
        resolved_org = None
        if credit_client:
            try:
                resolved_org = await credit_client._resolve_org_id(domain)
                credit_gated = is_credit_gated(resolved_org)
                if credit_gated:
                    credit_result = await credit_client.check_credits(domain, resolved_org)
                    if not credit_result.allowed:
                        return "AI credit limit reached. Please contact your administrator.", query_id, None
            except Exception as e:
                LOGGER.error(f"Credit check failed, allowing request: {e}")

        provider = get_llm_provider(model=model, temperature=0.0, max_tokens=3000)
        response = await provider.generate(llm_messages, tools=[search_tool])

        if response.content:
            response_text = response.content
            response_text, citation_to_url = deduplicate_citations(response_text)

            citations = format_citations(extract_citations(retrieved_documents))
            url_to_title = extract_citation_info_from_citations(citations, retrieved_documents)

            sources_message = None
            if citation_to_url:
                sorted_citations = sorted(citation_to_url.keys())
                sources_lines = []
                for citation_num in sorted_citations:
                    url = citation_to_url[citation_num]
                    title = url_to_title.get(url, generate_title_from_url(url))
                    formatted_line = f"[{citation_num}. {title}]({url})"
                    sources_lines.append(formatted_line)
                sources_message = "\n".join(sources_lines)

            if conversation_id:
                await log_query_to_db(response_text, domain, conversation_id, role="ASSISTANT", source="DISCORD")

            if credit_client and credit_gated and resolved_org:
                try:
                    output_tokens = getattr(response.metrics, "output_tokens", 0) if hasattr(response, "metrics") else 0
                    if output_tokens > 0:
                        await credit_client.log_usage(domain, {
                            "type": "ask_fern",
                            "event_type": "DISCORD",
                            "response_tokens": output_tokens,
                            "metadata": {"domain": domain},
                        }, resolved_org)
                except Exception as e:
                    LOGGER.error(f"Failed to log credit usage: {e}")

            return response_text, query_id, sources_message

        return "I couldn't find any relevant information to answer your question.", query_id, None

    except Exception as e:
        LOGGER.error(f"Error processing message: {e}")
        return "Sorry, I encountered an error while processing your request. Please try again later.", query_id, None
