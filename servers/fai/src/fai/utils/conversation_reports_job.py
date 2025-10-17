import asyncio
from datetime import (
    UTC,
    datetime,
    timedelta,
)
from typing import Any

from sqlalchemy import (
    delete,
    distinct,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from fai.db import async_session_maker
from fai.models.db.conversation_report_db import ConversationReportDb
from fai.models.db.query_db import QueryDb
from fai.settings import LOGGER
from fai.utils.generate.conversation_classification import (
    CONVERSATION_CLASSIFICATION_PROMPT,
    ConversationClassification,
)
from fai.utils.generate_model import generate_anthropic_generic_async


async def get_conversations_to_process(db: AsyncSession, start: datetime, end: datetime) -> list[tuple[str, str]]:
    cutoff_time: datetime = end - timedelta(minutes=10)

    conversations_in_window_query = (
        select(distinct(QueryDb.conversation_id)).where(QueryDb.created_at >= start).where(QueryDb.created_at <= end)
    )
    result = await db.execute(conversations_in_window_query)
    conversation_ids_in_window = list({row[0] for row in result.all()})

    if not conversation_ids_in_window:
        return []

    LOGGER.info(f"Found {len(conversation_ids_in_window)} conversations in time window, checking eligibility...")

    eligible_conversations = []

    for conv_id in conversation_ids_in_window:
        latest_query = (
            select(QueryDb.created_at, QueryDb.domain, QueryDb.role)
            .where(QueryDb.conversation_id == conv_id)
            .order_by(QueryDb.created_at.desc())
        )
        result = await db.execute(latest_query)
        messages = result.all()

        if not messages:
            continue

        latest_message_time = messages[0][0]
        domain = messages[0][1]

        if latest_message_time > cutoff_time:
            continue

        has_assistant = any(msg[2] == "ASSISTANT" for msg in messages)
        if not has_assistant:
            continue

        eligible_conversations.append((conv_id, domain))

    LOGGER.info(f"Found {len(eligible_conversations)} eligible conversations after filtering")

    return eligible_conversations


async def format_conversation(db: AsyncSession, conversation_id: str) -> str:
    query = select(QueryDb).where(QueryDb.conversation_id == conversation_id).order_by(QueryDb.created_at)

    result = await db.execute(query)
    queries = result.scalars().all()

    formatted_lines: list[str] = []
    for query in queries:
        role_label = "User" if query.role == "USER" else "Assistant"
        formatted_lines.append(f"{role_label}: {query.text}")

    return "\n".join(formatted_lines)


async def classify_conversation_with_retry(
    conversation_text: str, max_retries: int = 3, retry_delay: int = 5
) -> ConversationClassification | None:
    for attempt in range(max_retries):
        try:
            result = await generate_anthropic_generic_async(
                response_type=ConversationClassification,
                prompt_template=CONVERSATION_CLASSIFICATION_PROMPT,
                conversation=conversation_text,
            )
            if result is not None:
                return result
        except Exception as e:
            LOGGER.warning(f"Attempt {attempt + 1}/{max_retries} failed to classify conversation: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)

    LOGGER.info("All immediate retries failed, waiting 5 minutes before final attempt")
    await asyncio.sleep(retry_delay * 60)

    try:
        result = await generate_anthropic_generic_async(
            response_type=ConversationClassification,
            prompt_template=CONVERSATION_CLASSIFICATION_PROMPT,
            conversation=conversation_text,
        )
        return result
    except Exception as e:
        LOGGER.exception(f"Final retry failed to classify conversation: {e}")
        return None


async def process_conversation_report_async(conversation_id: str, domain: str) -> tuple[str, bool, str]:
    """
    Process a single conversation report with its own database session.
    This is designed to be run in parallel.
    """
    try:
        async with async_session_maker() as db:
            delete_stmt = delete(ConversationReportDb).where(ConversationReportDb.conversation_id == conversation_id)
            await db.execute(delete_stmt)
            await db.commit()

            conversation_text = await format_conversation(db, conversation_id)

            classification = await classify_conversation_with_retry(conversation_text)

            if classification is None:
                return (conversation_id, False, "Classification failed after all retries")

            new_report = ConversationReportDb(
                conversation_id=conversation_id,
                domain=domain,
                resolved=classification.resolved,
                created_at=datetime.now(UTC),
            )
            db.add(new_report)
            await db.commit()

            return (
                conversation_id,
                True,
                f"Report created: resolved={classification.resolved}",
            )

    except Exception as e:
        LOGGER.exception(f"Failed to process conversation report for {conversation_id}")
        return (conversation_id, False, str(e))


async def process_conversation_reports(
    db: AsyncSession, start: datetime | None = None, end: datetime | None = None
) -> dict[str, Any]:
    if end is None:
        end = datetime.now(UTC)

    if start is None:
        start = end - timedelta(hours=1)

    LOGGER.info(f"Processing conversation reports from {start} to {end}")

    conversations = await get_conversations_to_process(db, start, end)

    LOGGER.info(f"Found {len(conversations)} conversations to process")

    if not conversations:
        LOGGER.info("No conversations found to process")
        return {
            "start_time": start,
            "end_time": end,
            "total_conversations": 0,
            "successful": 0,
            "failed": 0,
            "results": [],
        }

    LOGGER.info(f"Found {len(conversations)} conversations to process")

    semaphore = asyncio.Semaphore(16)

    async def process_with_semaphore(conv_id: str, domain: str) -> tuple[str, bool, str]:
        async with semaphore:
            return await process_conversation_report_async(conv_id, domain)

    tasks = [process_with_semaphore(conv_id, domain) for conv_id, domain in conversations]
    report_results = await asyncio.gather(*tasks, return_exceptions=True)

    results: list[dict[str, Any]] = []
    successful = 0
    failed = 0

    for result in report_results:
        if isinstance(result, Exception):
            LOGGER.error(f"Exception processing conversation report: {result}")
            results.append(
                {
                    "conversation_id": "unknown",
                    "success": False,
                    "message": str(result),
                }
            )
            failed += 1
        elif isinstance(result, tuple) and len(result) == 3:
            results.append(
                {
                    "conversation_id": result[0],
                    "success": result[1],
                    "message": result[2],
                }
            )
            if result[1]:
                successful += 1
            else:
                failed += 1

    LOGGER.info(f"Conversation report processing complete: {successful} successful, {failed} failed")

    return {
        "start_time": start,
        "end_time": end,
        "total_conversations": len(conversations),
        "successful": successful,
        "failed": failed,
        "results": results,
    }
