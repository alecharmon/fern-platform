import hashlib

from fastapi.encoders import jsonable_encoder
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from turbopuffer import NOT_GIVEN
from turbopuffer import AsyncTurbopuffer
from turbopuffer.types.row import Row

from settings import CONFIG
from settings import LOGGER
from settings import VARIABLES
from src.fai.models.db.document import Document
from src.fai.utils.turbopuffer.namespace import get_tpuf_namespace
from src.fai.utils.turbopuffer.schemas import get_data_index_tpuf_schema
from src.fai.utils.turbopuffer.schemas import get_query_index_tpuf_schema


def prefixed_id(namespace: str, original_id: str, max_len: int = 64) -> str:
    new_id = f"{namespace}:{original_id}"
    if len(new_id.encode("utf-8")) <= max_len:
        return new_id
    hashed = hashlib.sha256(original_id.encode("utf-8")).hexdigest()[:16]
    short_ns = namespace[: max_len - len(hashed) - 1]
    return f"{short_ns}:{hashed}"


async def sync_db_to_tpuf(domain: str, db: AsyncSession, index_name: str = "documents") -> None:
    documents = await db.execute(select(Document).where(Document.domain == domain).where(Document.is_active == True))
    documents = documents.scalars().all()
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, index_name)
            target_ns = tpuf_client.namespace(target_namespace_id)
            try:
                await target_ns.delete_all()
            except Exception:
                LOGGER.info(f"No documents to delete from {target_namespace_id}")
            tbuf_records = []
            for document in documents:
                tbuf_records.extend(await document.to_tpuf_record(openai_client))
            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Wrote {len(documents)} documents to {target_namespace_id}")


async def sync_index_to_target(domain: str, source_index_name: str, target_index_name: str) -> None:
    source_namespace_id = get_tpuf_namespace(domain, source_index_name)
    target_namespace_id = get_tpuf_namespace(domain, target_index_name)
    LOGGER.info(f"Syncing index {source_namespace_id} to {target_namespace_id} for domain {domain}")
    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        source_ns = tpuf_client.namespace(source_namespace_id)
        target_ns = tpuf_client.namespace(target_namespace_id)

        await target_ns.write(delete_by_filter=["source", "Eq", source_index_name])

        last_id = None
        while True:
            result = await source_ns.query(
                rank_by=("id", "asc"),
                top_k=1000,
                include_attributes=True,
                filters=("id", "Gt", last_id) if last_id is not None else NOT_GIVEN,
            )

            prefixed_rows = []
            for row in result.rows:
                new_row = Row.from_dict(row.model_dump())
                new_row.id = prefixed_id(source_namespace_id, row.id)
                new_row.source = source_index_name
                prefixed_rows.append(new_row)

            await target_ns.write(
                upsert_rows=prefixed_rows, distance_metric="cosine_distance", schema=get_query_index_tpuf_schema()
            )

            if len(result.rows) < 1000:
                break
            last_id = result.rows[-1].id
