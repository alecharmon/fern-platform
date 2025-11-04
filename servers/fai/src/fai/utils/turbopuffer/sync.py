import hashlib

from fastapi.encoders import jsonable_encoder
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from turbopuffer import (
    NOT_GIVEN,
    AsyncTurbopuffer,
)
from turbopuffer.types.row import Row

from fai.models.db.document_db import DocumentDb
from fai.models.db.guidance_db import GuidanceDb
from fai.models.db.slack_context_db import SlackContextDb
from fai.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)
from fai.utils.turbopuffer.namespace import (
    get_document_index_name,
    get_guidance_index_name,
    get_slack_context_index_name,
    get_tpuf_namespace,
)
from fai.utils.turbopuffer.schemas import (
    get_data_index_tpuf_schema,
    get_query_index_tpuf_schema,
)


def prefixed_id(namespace: str, original_id: str, max_len: int = 64) -> str:
    new_id = f"{namespace}:{original_id}"
    if len(new_id.encode("utf-8")) <= max_len:
        return new_id
    hashed = hashlib.sha256(original_id.encode("utf-8")).hexdigest()[:16]
    short_ns = namespace[: max_len - len(hashed) - 1]
    return f"{short_ns}:{hashed}"


async def sync_documents_to_tpuf(domain: str, document_ids: list[str], db: AsyncSession) -> None:
    if not document_ids:
        LOGGER.info("No document IDs provided for sync, skipping")
        return

    documents = await db.execute(select(DocumentDb).where(DocumentDb.domain == domain, DocumentDb.id.in_(document_ids)))
    documents = documents.scalars().all()

    if not documents:
        LOGGER.warning(f"No documents found for IDs {document_ids} in domain {domain}")
        return

    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, get_document_index_name())
            target_ns = tpuf_client.namespace(target_namespace_id)

            tbuf_records = []
            for document in documents:
                tbuf_records.append(await document.to_tpuf_record(openai_client))

            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Upserted {len(documents)} documents to {target_namespace_id}")


async def delete_documents_from_tpuf(domain: str, document_ids: list[str]) -> None:
    if not document_ids:
        LOGGER.info("No document IDs provided for deletion, skipping")
        return

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        target_namespace_id = get_tpuf_namespace(domain, get_document_index_name())
        target_ns = tpuf_client.namespace(target_namespace_id)

        for document_id in document_ids:
            await target_ns.write(delete_by_filter=["id", "Eq", document_id])

        LOGGER.info(f"Deleted {len(document_ids)} documents from {target_namespace_id}")


async def sync_document_db_to_tpuf(domain: str, db: AsyncSession) -> None:
    documents = await db.execute(select(DocumentDb).where(DocumentDb.domain == domain))
    documents = documents.scalars().all()
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, get_document_index_name())
            target_ns = tpuf_client.namespace(target_namespace_id)
            try:
                await target_ns.delete_all()
            except Exception:
                LOGGER.info(f"No documents to delete from {target_namespace_id}")
            tbuf_records = []
            for document in documents:
                tbuf_records.append(await document.to_tpuf_record(openai_client))

            if tbuf_records:
                await target_ns.write(
                    upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                    distance_metric="cosine_distance",
                    schema=get_data_index_tpuf_schema(),
                )
                LOGGER.info(f"Wrote {len(documents)} documents to {target_namespace_id}")
            else:
                LOGGER.info(f"No documents to write to {target_namespace_id}")


async def sync_guidance_db_to_tpuf(domain: str, db: AsyncSession) -> None:
    guidances = await db.execute(select(GuidanceDb).where(GuidanceDb.domain == domain))
    guidances = guidances.scalars().all()
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, get_guidance_index_name())
            target_ns = tpuf_client.namespace(target_namespace_id)
            try:
                await target_ns.delete_all()
            except Exception:
                LOGGER.info(f"No guidances to delete from {target_namespace_id}")
            tbuf_records = []
            for guidance in guidances:
                tbuf_records.extend(await guidance.to_tpuf_record(openai_client))
            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Wrote {len(guidances)} guidances to {target_namespace_id}")


async def sync_slack_context_db_to_tpuf(domain: str, db: AsyncSession) -> None:
    slack_contexts = await db.execute(select(SlackContextDb).where(SlackContextDb.domain == domain))
    slack_contexts = slack_contexts.scalars().all()
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, get_slack_context_index_name())
            target_ns = tpuf_client.namespace(target_namespace_id)
            try:
                await target_ns.delete_all()
            except Exception:
                LOGGER.info(f"No slack contexts to delete from {target_namespace_id}")
            tbuf_records = []
            for slack_context in slack_contexts:
                tbuf_records.append(await slack_context.to_tpuf_record(openai_client))
            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Wrote {len(slack_contexts)} slack contexts to {target_namespace_id}")


async def sync_documents_to_query_index(
    domain: str, document_ids: list[str], source_index_name: str, target_index_name: str
) -> None:
    if not document_ids:
        LOGGER.info("No document IDs provided for query index sync, skipping")
        return

    source_namespace_id = get_tpuf_namespace(domain, source_index_name)
    target_namespace_id = get_tpuf_namespace(domain, target_index_name)

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        source_ns = tpuf_client.namespace(source_namespace_id)
        target_ns = tpuf_client.namespace(target_namespace_id)

        for document_id in document_ids:
            prefixed_doc_id = prefixed_id(source_namespace_id, document_id)
            await target_ns.write(delete_by_filter=["id", "Eq", prefixed_doc_id])

        prefixed_rows = []
        for document_id in document_ids:
            result = await source_ns.query(filters=("id", "Eq", document_id), top_k=1, include_attributes=True)

            if result.rows:
                row = result.rows[0]
                new_row = Row.from_dict(row.model_dump())
                new_row.id = prefixed_id(source_namespace_id, document_id)
                new_row.source = source_index_name
                prefixed_rows.append(new_row)

        if prefixed_rows:
            await target_ns.write(
                upsert_rows=prefixed_rows, distance_metric="cosine_distance", schema=get_query_index_tpuf_schema()
            )
            LOGGER.info(f"Synced {len(prefixed_rows)} documents to query index {target_namespace_id}")


async def delete_documents_from_query_index(
    domain: str, document_ids: list[str], source_index_name: str, target_index_name: str
) -> None:
    if not document_ids:
        LOGGER.info("No document IDs provided for query index deletion, skipping")
        return

    source_namespace_id = get_tpuf_namespace(domain, source_index_name)
    target_namespace_id = get_tpuf_namespace(domain, target_index_name)

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        target_ns = tpuf_client.namespace(target_namespace_id)

        for document_id in document_ids:
            prefixed_doc_id = prefixed_id(source_namespace_id, document_id)
            await target_ns.write(delete_by_filter=["id", "Eq", prefixed_doc_id])

        LOGGER.info(f"Deleted {len(document_ids)} documents from query index {target_namespace_id}")


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
        source_ns_exists = await source_ns.exists()
        if source_ns_exists:
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
