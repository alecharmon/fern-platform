import asyncio
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

from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select

from fai.db import async_session_maker
from fai.models.api.update_channel_settings import ChannelSettings
from fai.models.db.query_db import QueryDb
from fai.models.db.slack_context_db import SlackContextDb
from fai.models.db.slack_integration_db import SlackIntegrationDb
from fai.models.db.slack_message_classification_db import SlackMessageClassificationDb
from fai.models.utils.chat import ChatMode
from fai.settings import LOGGER
from fai.utils.chat.response.anthropic import (
    get_anthropic_index_response,
    get_anthropic_response,
)
from fai.utils.chat.retrieve.retrieve import retrieve
from fai.utils.chat.roles import create_delimited_role_combinations
from fai.utils.generate.message_classification import (
    CLASSIFICATION_PROMPT,
    MessageClassification,
)
from fai.utils.generate_model import generate_anthropic_generic_async
from fai.utils.github_utils import get_repo_from_docs_domain
from fai.utils.slack.client import (
    add_reaction,
    send_slack_message,
)
from fai.utils.slack.edit_detection import detect_edit_flag
from fai.utils.slack.edit_handler import (
    create_editing_session,
    get_editing_session_status,
    get_or_create_editing_session_for_thread,
    interrupt_editing_session,
    invoke_editing_lambda,
    store_editing_session_for_thread,
    wait_for_interruption,
)
from fai.utils.slack.lambda_invoke import invoke_fai_lambda_for_docs_update
from fai.utils.slack.postprocessing import SlackifyMarkdown
from fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_slack_context_index_name,
)
from fai.utils.turbopuffer.sync import (
    sync_index_to_target,
    sync_slack_context_db_to_tpuf,
)


async def classify_message(
    text: str,
    message_history: list[dict[str, str]] | None = None,
    bot_user_id: str | None = None,
) -> MessageClassification:
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
        LOGGER.warning(f"Failed to classify message after retries: {text[:100]}, defaulting to 'ignore'")
        return MessageClassification(classification="ignore", reasoning="Classification failed - defaulting to ignore")

    LOGGER.info(f"Message classification: {result.classification} - Reasoning: {result.reasoning}")

    return result


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
    message_classification: Literal["question", "index", "ignore"] | None = None,
) -> Literal["question", "index", "ignore"]:
    if channel_settings is None:
        channel_settings = ChannelSettings()

    if channel_settings.respond_to == "auto":
        if message_classification is None:
            LOGGER.warning("Auto mode enabled but no message classification provided")
            return "ignore"
        return message_classification

    if channel_settings.respond_to == "mentions_only":
        if not is_app_mention:
            return "ignore"
        if message_classification is not None:
            return message_classification
        LOGGER.warning("Mention received but no classification provided, defaulting to 'question'")
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


async def log_slack_classification_to_db(
    message_ts: str,
    team_id: str,
    classification: Literal["question", "index", "ignore"],
    message_text: str,
    reasoning: str | None = None,
) -> str | None:
    try:
        async with async_session_maker() as session:
            classification_record = SlackMessageClassificationDb(
                id=str(uuid4()),
                message_ts=message_ts,
                team_id=team_id,
                classification=classification,
                reasoning=reasoning,
                message_text=message_text,
                classified_at=datetime.now(UTC),
            )
            session.add(classification_record)
            await session.commit()
            LOGGER.info(f"Logged message classification to database: {classification_record.id}")
            return classification_record.id
    except Exception as e:
        LOGGER.error(f"Failed to log classification to database: {e}")
        return None


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
            response = SlackifyMarkdown().serialize(response)
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
    message_ts = event.get("ts")

    raw_text = event.get("text", "")
    is_edit_mode, cleaned_text = detect_edit_flag(raw_text)

    context = SlackMessageContext(
        text=cleaned_text,
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

    if is_edit_mode:
        LOGGER.info(f"Edit mode detected in message from {context.user}: {context.text[:100]}...")

        if integration.slack_bot_token and message_ts and context.channel:
            try:
                await add_reaction(context.channel, message_ts, "hammer_and_wrench", integration.slack_bot_token)
                LOGGER.info(f"Added hammer_and_wrench reaction to edit message {message_ts}")
            except Exception as e:
                LOGGER.warning(f"Failed to add reaction: {e}")

        is_new_session = False
        existing_editing_id = await get_or_create_editing_session_for_thread(
            context.team_id, context.channel, context.thread_ts
        )

        if existing_editing_id:
            LOGGER.info(f"Found existing editing session {existing_editing_id} for thread {context.thread_ts}")

            session_status = await get_editing_session_status(existing_editing_id)
            LOGGER.info(f"Existing session {existing_editing_id} status: {session_status}")

            if session_status and session_status.value == "interrupted":
                LOGGER.warning(
                    f"Session {existing_editing_id} is already being interrupted by another request. "
                    "Not proceeding to avoid race condition."
                )
                error_text = (
                    "⏳ Previous edit session is currently being interrupted by another request. "
                    "Please wait a moment and try again."
                )
                return SlackMessageResponse(
                    response_text=error_text,
                    channel=context.channel,
                    thread_ts=context.thread_ts,
                    bot_token=integration.slack_bot_token,
                    query_id=None,
                    user_id=context.user,
                )
            elif session_status and session_status.value == "startup":
                LOGGER.info(f"Session {existing_editing_id} is in STARTUP state, waiting for it to become ACTIVE")
                max_wait: int = 30
                poll_interval: float = 0.5
                elapsed: float = 0

                while elapsed < max_wait:
                    await asyncio.sleep(poll_interval)
                    elapsed += poll_interval

                    session_status = await get_editing_session_status(existing_editing_id)
                    if session_status and session_status.value in ["active", "waiting"]:
                        LOGGER.info(
                            f"Session {existing_editing_id} transitioned to {session_status.value}, "
                            f"proceeding with interruption"
                        )
                        break
                    elif session_status and session_status.value not in ["startup", "active", "waiting"]:
                        LOGGER.warning(
                            f"Session {existing_editing_id} in unexpected state {session_status.value}, aborting"
                        )
                        error_text = "❌ Session is in an unexpected state. Please try again."
                        return SlackMessageResponse(
                            response_text=error_text,
                            channel=context.channel,
                            thread_ts=context.thread_ts,
                            bot_token=integration.slack_bot_token,
                            query_id=None,
                            user_id=context.user,
                        )

                if not session_status or session_status.value not in ["active", "waiting"]:
                    LOGGER.warning(f"Timeout waiting for session {existing_editing_id} to become ACTIVE/WAITING")
                    error_text = "⏳ Previous edit session is still starting up. Please wait a moment and try again."
                    return SlackMessageResponse(
                        response_text=error_text,
                        channel=context.channel,
                        thread_ts=context.thread_ts,
                        bot_token=integration.slack_bot_token,
                        query_id=None,
                        user_id=context.user,
                    )

            if session_status and session_status.value in ["active", "waiting"]:
                LOGGER.info(f"Interrupting {session_status.value} session {existing_editing_id} for new edit request")

                interrupt_success = await interrupt_editing_session(existing_editing_id)

                if interrupt_success:
                    LOGGER.info(f"Waiting for session {existing_editing_id} interruption to complete")
                    wait_success = await wait_for_interruption(existing_editing_id)

                    if wait_success:
                        if integration.slack_bot_token:
                            interruption_msg = "⚠️ Interrupted previous edit session to process new request"
                            try:
                                await send_slack_message(
                                    channel=context.channel,
                                    text=interruption_msg,
                                    bot_token=integration.slack_bot_token,
                                    thread_ts=context.thread_ts,
                                )
                                LOGGER.info(f"Posted interruption message to thread {context.thread_ts}")
                            except Exception as e:
                                LOGGER.error(f"Failed to post interruption message: {e}", exc_info=True)
                    else:
                        LOGGER.error(
                            f"Timeout waiting for interruption of session {existing_editing_id}. "
                            "Not proceeding with new request to avoid duplicate processing."
                        )
                        error_text = (
                            "⏳ Previous edit session is still processing and couldn't be interrupted "
                            "within 30 seconds. Please wait a moment and try again."
                        )
                        return SlackMessageResponse(
                            response_text=error_text,
                            channel=context.channel,
                            thread_ts=context.thread_ts,
                            bot_token=integration.slack_bot_token,
                            query_id=None,
                            user_id=context.user,
                        )
                elif session_status.value == "waiting":
                    LOGGER.info(f"Session {existing_editing_id} is WAITING and ready to resume")
                else:
                    LOGGER.error(f"Failed to interrupt session {existing_editing_id}. Cannot proceed safely.")
                    error_text = "❌ Failed to interrupt the previous edit session. Please try again."
                    return SlackMessageResponse(
                        response_text=error_text,
                        channel=context.channel,
                        thread_ts=context.thread_ts,
                        bot_token=integration.slack_bot_token,
                        query_id=None,
                        user_id=context.user,
                    )
            else:
                status_str = session_status.value if session_status else "unknown"
                LOGGER.error(f"Unexpected session status: {status_str} for session {existing_editing_id}")
                error_text = "❌ Session is in an unexpected state. Please try again."
                return SlackMessageResponse(
                    response_text=error_text,
                    channel=context.channel,
                    thread_ts=context.thread_ts,
                    bot_token=integration.slack_bot_token,
                    query_id=None,
                    user_id=context.user,
                )
        else:
            LOGGER.info(f"No existing session found for thread {context.thread_ts}, creating new session")

            repository = await get_repo_from_docs_domain(domain_to_use)
            if not repository:
                error_text = (
                    "Sorry, I couldn't determine the repository for this domain. "
                    "Please ensure the domain is configured correctly."
                )
                return SlackMessageResponse(
                    response_text=error_text,
                    channel=context.channel,
                    thread_ts=context.thread_ts,
                    bot_token=integration.slack_bot_token,
                    query_id=None,
                    user_id=context.user,
                )

            is_new_session = True
            existing_editing_id = await create_editing_session(repository, base_branch="main")

            if not existing_editing_id:
                error_text = "Sorry, I couldn't create an editing session. Please try again."
                return SlackMessageResponse(
                    response_text=error_text,
                    channel=context.channel,
                    thread_ts=context.thread_ts,
                    bot_token=integration.slack_bot_token,
                    query_id=None,
                    user_id=context.user,
                )

            try:
                await store_editing_session_for_thread(
                    context.team_id, context.channel, context.thread_ts, existing_editing_id
                )
                LOGGER.info(
                    f"Stored editing session {existing_editing_id} mapping for thread {context.thread_ts} "
                    "before Lambda invocation"
                )
            except Exception as e:
                LOGGER.error(f"Failed to store editing session mapping: {e}", exc_info=True)

        result = await invoke_editing_lambda(
            prompt=context.text,
            domain=domain_to_use,
            base_branch="main",
            editing_id=existing_editing_id,
            team_id=context.team_id,
            channel_id=context.channel,
            thread_ts=context.thread_ts,
        )

        if result:
            action = "Starting" if is_new_session else "Resuming"
            response_text = f"✏️ {action} edit session for repository `{result['repository']}`..."
            response_text += "\n_Session ready_"

            return SlackMessageResponse(
                response_text=response_text,
                channel=context.channel,
                thread_ts=context.thread_ts,
                bot_token=integration.slack_bot_token,
                query_id=None,
                user_id=context.user,
            )
        else:
            error_text = (
                "Sorry, I couldn't start the editing session. " "Please ensure the domain is configured correctly."
            )
            return SlackMessageResponse(
                response_text=error_text,
                channel=context.channel,
                thread_ts=context.thread_ts,
                bot_token=integration.slack_bot_token,
                query_id=None,
                user_id=context.user,
            )

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

    classification_result = None
    should_classify = False
    if channel_settings and channel_settings.respond_to == "auto":
        should_classify = True
    elif (channel_settings is None or channel_settings.respond_to == "mentions_only") and is_app_mention:
        should_classify = True

    if should_classify:
        LOGGER.info(f"Classifying message: {context.text[:100]}...")
        try:
            classification_result = await classify_message(context.text, message_history, integration.slack_bot_user_id)
            LOGGER.info(
                f"Classification: {classification_result.classification}\nReasoning: {classification_result.reasoning}"
            )
        except Exception as e:
            LOGGER.error(f"Error classifying message: {e}, defaulting to 'ignore'")
            classification_result = MessageClassification(
                classification="ignore", reasoning=f"Exception during classification: {str(e)}"
            )

        await log_slack_classification_to_db(
            str(message_ts) or "",
            context.team_id,
            classification_result.classification,
            context.text,
            classification_result.reasoning,
        )

    message_classification = classification_result.classification if classification_result else None
    message_action = get_message_action(channel_settings, is_app_mention, message_classification)

    LOGGER.info(
        f"Message action determined: {message_action} (channel={context.channel}, "
        f"is_mention={is_app_mention}, classification={message_classification})"
    )

    if message_action == "ignore":
        LOGGER.info(f"Ignoring message from {context.user} in {context.channel}")
        return SlackMessageResponse("", "", None, None)

    elif message_action == "index":
        LOGGER.info(f"Message marked for indexing from {context.user} in {context.channel}: {context.text[:100]}...")

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

                conversation_text = "\n\n".join([f"{msg['role'].upper()}: {msg['content']}" for msg in messages])
                await invoke_fai_lambda_for_docs_update(
                    conversation_history=conversation_text,
                    domain=domain_to_use,
                    base_branch="main",
                    team_id=context.team_id,
                    channel_id=context.channel,
                    thread_ts=context.thread_ts,
                )
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
