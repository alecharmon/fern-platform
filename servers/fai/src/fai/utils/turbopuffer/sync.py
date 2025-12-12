import hashlib

from fastapi.encoders import jsonable_encoder
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from turbopuffer import (
    NOT_GIVEN,
    APITimeoutError,
    AsyncTurbopuffer,
)
from turbopuffer.types.row import Row

from fai.models.db.code_db import CodeDb
from fai.models.db.document_db import DocumentDb
from fai.models.db.guidance_db import GuidanceDb
from fai.models.db.slack_context_db import SlackContextDb
from fai.models.db.website_db import WebsiteDb
from fai.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)
from fai.utils.turbopuffer.namespace import (
    get_code_index_name,
    get_document_index_name,
    get_guidance_index_name,
    get_slack_context_index_name,
    get_tpuf_namespace,
    get_website_index_name,
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


async def sync_code_to_tpuf(domain: str, code_ids: list[str], db: AsyncSession) -> None:
    if not code_ids:
        LOGGER.info("No code IDs provided for sync, skipping")
        return

    code_records = await db.execute(select(CodeDb).where(CodeDb.domain == domain, CodeDb.id.in_(code_ids)))
    code_records = code_records.scalars().all()

    if not code_records:
        LOGGER.warning(f"No code found for IDs {code_ids} in domain {domain}")
        return

    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, get_code_index_name())
            target_ns = tpuf_client.namespace(target_namespace_id)

            tbuf_records = []
            for code in code_records:
                tbuf_records.append(await code.to_tpuf_record(openai_client))

            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Upserted {len(code_records)} code records to {target_namespace_id}")


async def delete_code_from_tpuf(domain: str, code_ids: list[str]) -> None:
    if not code_ids:
        LOGGER.info("No code IDs provided for deletion, skipping")
        return

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        target_namespace_id = get_tpuf_namespace(domain, get_code_index_name())
        target_ns = tpuf_client.namespace(target_namespace_id)

        for code_id in code_ids:
            await target_ns.write(delete_by_filter=["id", "Eq", code_id])

        LOGGER.info(f"Deleted {len(code_ids)} code records from {target_namespace_id}")


async def sync_code_db_to_tpuf(domain: str, db: AsyncSession) -> None:
    code_records = await db.execute(select(CodeDb).where(CodeDb.domain == domain))
    code_records = code_records.scalars().all()
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, get_code_index_name())
            target_ns = tpuf_client.namespace(target_namespace_id)
            try:
                await target_ns.delete_all()
            except Exception:
                LOGGER.info(f"No code to delete from {target_namespace_id}")
            tbuf_records = []
            for code in code_records:
                tbuf_records.append(await code.to_tpuf_record(openai_client))

            if tbuf_records:
                await target_ns.write(
                    upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                    distance_metric="cosine_distance",
                    schema=get_data_index_tpuf_schema(),
                )
                LOGGER.info(f"Wrote {len(code_records)} code records to {target_namespace_id}")
            else:
                LOGGER.info(f"No code to write to {target_namespace_id}")


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


async def sync_websites_to_tpuf(domain: str, website_ids: list[str], db: AsyncSession) -> None:
    if not website_ids:
        LOGGER.info("No website IDs provided for sync, skipping")
        return

    websites = await db.execute(select(WebsiteDb).where(WebsiteDb.domain == domain, WebsiteDb.id.in_(website_ids)))
    websites = websites.scalars().all()

    if not websites:
        LOGGER.warning(f"No websites found for IDs {website_ids} in domain {domain}")
        return

    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, get_website_index_name())
            target_ns = tpuf_client.namespace(target_namespace_id)

            tbuf_records = []
            for website in websites:
                tbuf_records.append(await website.to_tpuf_record(openai_client))

            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Upserted {len(websites)} websites to {target_namespace_id}")


async def delete_websites_from_tpuf(domain: str, website_ids: list[str]) -> None:
    if not website_ids:
        LOGGER.info("No website IDs provided for deletion, skipping")
        return

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        target_namespace_id = get_tpuf_namespace(domain, get_website_index_name())
        target_ns = tpuf_client.namespace(target_namespace_id)

        for website_id in website_ids:
            await target_ns.write(delete_by_filter=["id", "Eq", website_id])

        LOGGER.info(f"Deleted {len(website_ids)} websites from {target_namespace_id}")


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


async def sync_websites_to_query_index(
    domain: str, website_ids: list[str], source_index_name: str, target_index_name: str
) -> None:
    if not website_ids:
        LOGGER.info("No website IDs provided for query index sync, skipping")
        return

    source_namespace_id = get_tpuf_namespace(domain, source_index_name)
    target_namespace_id = get_tpuf_namespace(domain, target_index_name)

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        source_ns = tpuf_client.namespace(source_namespace_id)
        target_ns = tpuf_client.namespace(target_namespace_id)

        for website_id in website_ids:
            prefixed_web_id = prefixed_id(source_namespace_id, website_id)
            await target_ns.write(delete_by_filter=["id", "Eq", prefixed_web_id])

        prefixed_rows = []
        for website_id in website_ids:
            result = await source_ns.query(filters=("id", "Eq", website_id), top_k=1, include_attributes=True)

            if result.rows:
                row = result.rows[0]
                new_row = Row.from_dict(row.model_dump())
                new_row.id = prefixed_id(source_namespace_id, website_id)
                new_row.source = source_index_name
                prefixed_rows.append(new_row)

        if prefixed_rows:
            await target_ns.write(
                upsert_rows=prefixed_rows, distance_metric="cosine_distance", schema=get_query_index_tpuf_schema()
            )
            LOGGER.info(f"Synced {len(prefixed_rows)} websites to query index {target_namespace_id}")


async def delete_websites_from_query_index(
    domain: str, website_ids: list[str], source_index_name: str, target_index_name: str
) -> None:
    if not website_ids:
        LOGGER.info("No website IDs provided for query index deletion, skipping")
        return

    source_namespace_id = get_tpuf_namespace(domain, source_index_name)
    target_namespace_id = get_tpuf_namespace(domain, target_index_name)

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        target_ns = tpuf_client.namespace(target_namespace_id)

        for website_id in website_ids:
            prefixed_web_id = prefixed_id(source_namespace_id, website_id)
            await target_ns.write(delete_by_filter=["id", "Eq", prefixed_web_id])

        LOGGER.info(f"Deleted {len(website_ids)} websites from query index {target_namespace_id}")


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


async def sync_index_to_target_incremental(
    domain: str, source_index_name: str, target_index_name: str, parent_ids: list[str]
) -> None:
    """
    Incrementally sync only specific parent_ids from source index to target query index.
    This is more efficient than full sync when only a subset of content has changed.
    """
    if not parent_ids:
        LOGGER.info("No parent_ids provided for incremental sync, completing successfully")
        return

    source_namespace_id = get_tpuf_namespace(domain, source_index_name)
    target_namespace_id = get_tpuf_namespace(domain, target_index_name)
    LOGGER.info(
        f"Incrementally syncing {len(parent_ids)} parent_ids from {source_namespace_id} to {target_namespace_id}"
    )

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
        max_retries=0,
        timeout=30.0,
    ) as tpuf_client:
        source_ns = tpuf_client.namespace(source_namespace_id)
        await source_ns.hint_cache_warm()
        target_ns = tpuf_client.namespace(target_namespace_id)

        delete_parent_id_batch_size = len(parent_ids)
        while delete_parent_id_batch_size >= 1:
            try:
                total_deleted = 0
                for i in range(0, len(parent_ids), delete_parent_id_batch_size):
                    batch = parent_ids[i:min(i+delete_parent_id_batch_size, len(parent_ids))]
                    result = await target_ns.write(
                        delete_by_filter=("And", [("source", "Eq", source_index_name), ("parent_id", "In", batch)])
                    )
                    LOGGER.info(
                        f"Deleted {result.rows_deleted or 0} records for {len(batch)} parent_ids"
                    )
                    total_deleted += result.rows_deleted or 0
                LOGGER.info(
                    f"Successfully deleted {total_deleted} records from {target_namespace_id}"
                )
                break
            except APITimeoutError:
                LOGGER.warning(
                    f"Batch delete with size {delete_parent_id_batch_size} timed out, "
                    f"trying batch size {delete_parent_id_batch_size // 2}"
                )
                delete_parent_id_batch_size = delete_parent_id_batch_size // 2
                if delete_parent_id_batch_size < 1:
                    LOGGER.error("Failed to delete records even with batch size 1")
                    raise

        source_ns_exists = await source_ns.exists()
        if not source_ns_exists:
            LOGGER.warning(f"Source namespace {source_namespace_id} does not exist")
            return

        total_synced = 0
        sync_parent_id_batch_size = len(parent_ids)

        while sync_parent_id_batch_size >= 1:
            try:
                for parent_idx in range(0, len(parent_ids), sync_parent_id_batch_size):
                    last_id = None
                    parent_id_batch = parent_ids[parent_idx:min(parent_idx+sync_parent_id_batch_size, len(parent_ids))]
                    filter_conditions = [("parent_id", "In", parent_id_batch)]
                    while True:
                        if last_id is not None:
                            filter_conditions.append(("id", "Gt", last_id))

                        result = await source_ns.query(
                            rank_by=("id", "asc"),
                            top_k=1000,
                            include_attributes=True,
                            filters=("And", filter_conditions),
                        )

                        if not result.rows:
                            break

                        prefixed_rows = []
                        for row in result.rows:
                            new_row = Row.from_dict(row.model_dump())
                            new_row.id = prefixed_id(source_namespace_id, row.id)
                            new_row.source = source_index_name
                            prefixed_rows.append(new_row)

                        await target_ns.write(
                            upsert_rows=prefixed_rows,
                            distance_metric="cosine_distance",
                            schema=get_query_index_tpuf_schema(),
                        )
                        total_synced += len(prefixed_rows)
                        LOGGER.info(f"Synced batch: {len(prefixed_rows)} records (total: {total_synced})")

                        last_id = result.rows[-1].id
                        if len(result.rows) < 1000:
                            break
                break
            except APITimeoutError:
                LOGGER.warning(
                    f"Batch sync with size {sync_parent_id_batch_size} timed out, "
                    f"trying batch size {sync_parent_id_batch_size // 2}"
                )
                sync_parent_id_batch_size = sync_parent_id_batch_size // 2
                if sync_parent_id_batch_size < 1:
                    LOGGER.error("Failed to sync records even with batch size 1")
                    raise

        LOGGER.info(f"Incremental sync completed: {total_synced} total records synced to {target_namespace_id}")
