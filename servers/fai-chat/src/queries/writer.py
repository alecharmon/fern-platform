import logging

from fern_fai_sdk import AsyncFernAI

from .models import QueryData

logger = logging.getLogger(__name__)


async def save_query(client: AsyncFernAI, data: QueryData) -> str | None:
    try:
        await client.query.create_query(
            domain=data.domain,
            query_id=data.query_id,
            conversation_id=data.conversation_id,
            query_domain=data.domain,
            text=data.text,
            role=data.role,
            source=data.source.upper(),
            created_at=data.created_at,
            time_to_first_token=data.time_to_first_token,
            subqueries=data.subqueries,
        )
        logger.info(f"Query saved: {data.query_id}")
        return data.query_id
    except Exception as e:
        logger.error(f"[query-writer] Failed to save query: {e}")
        return None
