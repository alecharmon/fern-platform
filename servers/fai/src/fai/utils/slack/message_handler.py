from dataclasses import dataclass
from datetime import (
    UTC,
    datetime,
)
from typing import (
    Any,
    Literal,
)
from uuid import uuid4

from pydantic import (
    BaseModel,
    Field,
)
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select

from src.fai.db import async_session_maker
from src.fai.models.api.update_channel_settings import ChannelSettings
from src.fai.models.db.query_db import QueryDb
from src.fai.models.db.slack_context_db import SlackContextDb
from src.fai.models.db.slack_integration_db import SlackIntegrationDb
from src.fai.models.utils.chat import ChatMode
from src.fai.utils.chat.response.anthropic import (
    get_anthropic_index_response,
    get_anthropic_response,
)
from src.fai.utils.chat.retrieve.retrieve import retrieve
from src.fai.utils.chat.roles import create_delimited_role_combinations
from src.fai.utils.generate_model import generate_anthropic_generic_async
from src.fai.utils.slack.client import add_reaction
from src.fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_slack_context_index_name,
)
from src.fai.utils.turbopuffer.sync import (
    sync_index_to_target,
    sync_slack_context_db_to_tpuf,
)
from src.settings import LOGGER


class MessageClassification(BaseModel):
    classification: Literal["question", "index", "ignore"] = Field(
        description=(
            "The classification of the message: 'question' for questions requiring a response, "
            "'index' for messages that request the bot to index a thread to improve its responses, "
            "'ignore' for casual chat/greetings"
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


async def classify_message(
    text: str,
    message_history: list[dict[str, str]] | None = None,
    bot_user_id: str | None = None,
) -> Literal["question", "index", "ignore"]:
    bot_info = ""
    if bot_user_id:
        bot_info = (
            f"**Bot Information**: The bot's Slack user ID is <@{bot_user_id}>. "
            "Any mentions to this ID are directed at the bot. Mentions to other user IDs are NOT for the bot."
        )

    history_context = ""
    if message_history and len(message_history) > 0:
        recent_messages = message_history[-3:]  # Last 3 messages for context
        history_lines = [f"{msg['role'].upper()}: {msg['content']}" for msg in recent_messages]
        history_context = "\nRecent conversation context:\n" + "\n".join(history_lines)

    result = await generate_anthropic_generic_async(
        response_type=MessageClassification,
        prompt_template=CLASSIFICATION_PROMPT,
        message_text=text,
        history_context=history_context,
        bot_info=bot_info,
    )

    if result is None:
        LOGGER.warning(f"Failed to classify message after retries: {text[:100]}")
        return "ignore"

    LOGGER.info(f"Message classification: {result.classification} - Reasoning: {result.reasoning}")
    return result.classification


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
    query_id: str | None = None
    user_id: str | None = None


async def get_slack_integration(team_id: str) -> SlackIntegrationDb | None:
    async with async_session_maker() as session:
        result = await session.execute(
            select(SlackIntegrationDb).where(SlackIntegrationDb.slack_team_id == team_id).limit(1)
        )
        return result.scalar_one_or_none()


def get_message_action(
    channel_settings: ChannelSettings | None,
    is_app_mention: bool,
    is_thread_message: bool,
    is_from_thread_starter: bool = False,
    message_classification: Literal["question", "index", "ignore"] | None = None,
) -> Literal["question", "index", "ignore"]:
    if channel_settings is None:
        channel_settings = ChannelSettings()

    if channel_settings.respond_to == "auto":
        if message_classification is None:
            LOGGER.warning("Auto mode enabled but no message classification provided")
            return "ignore"

        return message_classification

    if is_app_mention:
        return "question"

    if channel_settings.respond_to == "all":
        if is_thread_message:
            return "question" if is_from_thread_starter else "ignore"
        return "question"

    return "ignore"


async def get_thread_history(
    channel: str, thread_ts: str, bot_token: str, bot_user_id: str | None = None
) -> list[dict[str, str]]:
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


async def log_query_to_db(
    query_text: str,
    domain: str,
    conversation_id: str,
    role: str = "USER",
    source: str = "SLACK",
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
            LOGGER.info(f"Logged Slack query to database: {db_query.query_id}")
            return db_query.query_id
    except Exception as e:
        LOGGER.error(f"Failed to log query to database: {e}")
        return None


async def save_slack_context_to_db(question: str, ideal_response: str, domain: str) -> str | None:
    try:
        slack_context_id = str(uuid4())
        now = datetime.now(UTC)

        async with async_session_maker() as session:
            slack_context = SlackContextDb(
                id=slack_context_id,
                domain=domain,
                question=question,
                ideal_response=ideal_response,
                created_at=now,
                updated_at=now,
            )
            session.add(slack_context)
            await session.commit()
            LOGGER.info(f"Saved SlackContext to database: {slack_context_id}")
            await sync_slack_context_db_to_tpuf(domain, session)
            LOGGER.info(f"Synced SlackContext to Turbopuffer for domain: {domain}")
            await sync_index_to_target(domain, get_slack_context_index_name(), get_query_index_name())
            LOGGER.info(f"Synced SlackContext to Query index for domain: {domain}")

        return slack_context_id
    except Exception as e:
        LOGGER.error(f"Failed to save SlackContext: {e}")
        return None


async def process_message(
    text: str,
    domain: str,
    bot_user_id: str | None = None,
    message_history: list[dict[str, str]] | None = None,
    model: str = "claude-4-sonnet-20250514",
    top_k: int = 5,
    conversation_id: str | None = None,
    allowed_roles: list[str] | None = None,
) -> tuple[str, str | None]:
    if bot_user_id and text:
        text = text.replace(f"<@{bot_user_id}>", "").strip()

    if not text:
        return "", None

    query_id = None
    if conversation_id:
        query_id = await log_query_to_db(text, domain, conversation_id, role="USER", source="SLACK")

    try:
        LOGGER.info(f"Retrieving documents for query: {text[:100]}...")

        exploded_roles = None
        if allowed_roles:
            roles_with_everyone = allowed_roles.copy()
            if "everyone" not in roles_with_everyone:
                roles_with_everyone.append("everyone")
            exploded_roles = create_delimited_role_combinations(roles_with_everyone)
            LOGGER.info(f"Using exploded roles for filtering: {exploded_roles}")

        query_results = await retrieve(text, domain, top_k=top_k, exploded_roles=exploded_roles)
        rag_records = [result.document for result in query_results if result.document]

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
            ChatMode.SLACK_CHAT,
        )

        if output_turns and len(output_turns) > 0:
            response = "\n\n".join([turn["text"] for turn in output_turns])
            if conversation_id:
                await log_query_to_db(response, domain, conversation_id, role="ASSISTANT", source="SLACK")
            return response, query_id

        return "I couldn't find any relevant information to answer your question.", query_id

    except Exception as e:
        LOGGER.error(f"Error processing message: {e}")
        return "Sorry, I encountered an error while processing your request. Please try again later.", query_id


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

    channel_settings = None
    domain_to_use = integration.domain
    roles_to_use = []
    if integration.settings and isinstance(integration.settings, dict):
        channel_config = integration.settings.get(context.channel, {})
        if channel_config:
            channel_settings = ChannelSettings(**channel_config)
            if channel_settings.domain_override:
                domain_to_use = channel_settings.domain_override
                LOGGER.info(f"Using domain override for channel {context.channel}: {domain_to_use}")
            if channel_settings.allowed_roles:
                roles_to_use = channel_settings.allowed_roles
                LOGGER.info(f"Using roles override for channel {context.channel}: {roles_to_use}")

    if not is_app_mention and integration.slack_bot_user_id and context.text:
        if f"<@{integration.slack_bot_user_id}>" in context.text:
            LOGGER.info(
                f"Bot mentioned in message text (user_id: {integration.slack_bot_user_id}), treating as app mention"
            )
            is_app_mention = True
            context.is_app_mention = True

    is_thread_message = event.get("thread_ts") is not None
    is_from_thread_starter = False

    if is_thread_message and integration.slack_bot_token:
        thread_ts = event.get("thread_ts")
        if thread_ts:
            try:
                client = AsyncWebClient(token=integration.slack_bot_token)
                result = await client.conversations_replies(
                    channel=context.channel, ts=thread_ts, limit=1, inclusive=True
                )
                if result["ok"] and result.get("messages"):
                    original_message = result["messages"][0]
                    original_user = original_message.get("user")
                    is_from_thread_starter = original_user == context.user
                    LOGGER.info(
                        f"Thread starter check: original_user={original_user}, "
                        f"current_user={context.user}, is_starter={is_from_thread_starter}"
                    )
            except Exception as e:
                LOGGER.error(f"Error checking thread starter: {e}")

    message_history = None
    if context.thread_ts and event.get("thread_ts"):
        LOGGER.info(f"Retrieving thread history for ts: {context.thread_ts}")
        message_history = await get_thread_history(
            context.channel, context.thread_ts, integration.slack_bot_token, integration.slack_bot_user_id
        )
        LOGGER.info(f"Retrieved {len(message_history)} messages from thread history")

    message_classification = None
    if channel_settings and channel_settings.respond_to == "auto":
        LOGGER.info(f"Auto mode enabled, classifying message: {context.text[:100]}...")
        try:
            message_classification = await classify_message(
                context.text, message_history, integration.slack_bot_user_id
            )
            LOGGER.info(f"Message classified as: {message_classification}")
        except Exception as e:
            LOGGER.error(f"Error classifying message: {e}, treating as 'ignore'")
            message_classification = "ignore"

    message_action = get_message_action(
        channel_settings, is_app_mention, is_thread_message, is_from_thread_starter, message_classification
    )

    LOGGER.info(
        f"Message action determined: {message_action} (channel={context.channel}, is_thread={is_thread_message}, "
        f"is_mention={is_app_mention}, is_thread_starter={is_from_thread_starter}, "
        f"classification={message_classification})"
    )

    if message_action == "ignore":
        LOGGER.info(f"Ignoring message from {context.user} in {context.channel}")
        return SlackMessageResponse("", "", None, None)

    elif message_action == "index":
        LOGGER.info(f"Message marked for indexing from {context.user} in {context.channel}: {context.text[:100]}...")

        message_ts = event.get("ts")
        if integration.slack_bot_token and message_ts and context.channel:
            try:
                await add_reaction(context.channel, message_ts, "brain", integration.slack_bot_token)
                LOGGER.info(f"Added brain reaction to message {message_ts} for indexing")
            except Exception as e:
                LOGGER.warning(f"Failed to add brain reaction: {e}")

        if message_history:
            messages = message_history.copy()
            if not messages or messages[-1]["content"] != context.text:
                messages.append({"role": "user", "content": context.text})
        else:
            messages = [{"role": "user", "content": context.text}]

        output_turns, context_data = await get_anthropic_index_response(
            model="claude-4-sonnet-20250514",
            messages=messages,
            domain=domain_to_use,
        )

        if output_turns and len(output_turns) > 0:
            response_text = "\n\n".join([turn["text"] for turn in output_turns])
        else:
            response_text = "I encountered an error while trying to help you index this content. Please try again."

        if context_data:
            slack_context_id = await save_slack_context_to_db(
                question=context_data["question"],
                ideal_response=context_data["ideal_response"],
                domain=domain_to_use,
            )
            if slack_context_id:
                LOGGER.info(f"Successfully saved and synced SlackContext: {slack_context_id}")
            else:
                LOGGER.error("Failed to save SlackContext to database")
                response_text += "\n\n⚠️ Note: There was an error saving the context. Please try again."

        return SlackMessageResponse(
            response_text=response_text,
            channel=context.channel,
            thread_ts=context.thread_ts,
            bot_token=integration.slack_bot_token,
            query_id=None,  # No query_id for indexing conversations
            user_id=context.user,
        )

    elif message_action == "question":
        LOGGER.info(f"Processing question from {context.user} in {context.channel}: {context.text[:100]}...")

        message_ts = event.get("ts")
        if integration.slack_bot_token and message_ts and context.channel:
            try:
                await add_reaction(context.channel, message_ts, "eyes", integration.slack_bot_token)
            except Exception as e:
                LOGGER.warning(f"Failed to add reaction: {e}")

        conversation_id = f"slack_{context.team_id}_{context.channel}_{context.thread_ts or context.user or 'direct'}"

        response_text, query_id = await process_message(
            context.text,
            domain_to_use,
            integration.slack_bot_user_id if context.is_app_mention else None,
            message_history,
            conversation_id=conversation_id,
            allowed_roles=roles_to_use if roles_to_use else None,
        )

        return SlackMessageResponse(
            response_text=response_text,
            channel=context.channel,
            thread_ts=context.thread_ts,
            bot_token=integration.slack_bot_token,
            query_id=query_id,
            user_id=context.user,
        )

    LOGGER.warning(f"Unexpected message action: {message_action}")
    return SlackMessageResponse("", "", None, None)
