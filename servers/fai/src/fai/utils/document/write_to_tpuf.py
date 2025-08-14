from typing import List

from fastapi.encoders import jsonable_encoder
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from turbopuffer import AsyncTurbopuffer

from settings import CONFIG
from settings import LOGGER
from settings import VARIABLES
from src.fai.db_models.document import Document
from src.fai.utils.index.get_tpuf_namespace import get_tpuf_namespace
from src.fai.utils.turbopuffer.schemas import get_data_index_tpuf_schema


async def write_document_to_tpuf(domain: str, document: Document, index_name: str = "documents") -> None:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            target_namespace_id = get_tpuf_namespace(domain, index_name)
            target_ns = tpuf_client.namespace(target_namespace_id)
            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in await document.to_tpuf_record(openai_client)],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Wrote {document.document_id} to {target_namespace_id}")


async def write_documents_to_tpuf(domain: str, documents: List[Document], index_name: str = "documents") -> None:
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
                if document.is_active:
                    tbuf_records.extend(await document.to_tpuf_record(openai_client))
            await target_ns.write(
                upsert_rows=[jsonable_encoder(record) for record in tbuf_records],
                distance_metric="cosine_distance",
                schema=get_data_index_tpuf_schema(),
            )
            LOGGER.info(f"Wrote {len(documents)} documents to {target_namespace_id}")


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
