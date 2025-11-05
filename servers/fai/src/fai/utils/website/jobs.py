import asyncio
import uuid
from datetime import (
    UTC,
    datetime,
)

from sqlalchemy import (
    delete,
    select,
)

from fai.db import async_session_maker
from fai.models.db.index_source_db import IndexSourceDb
from fai.models.db.website_db import WebsiteDb
from fai.settings import LOGGER
from fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_website_index_name,
)
from fai.utils.turbopuffer.sync import (
    sync_websites_to_query_index,
    sync_websites_to_tpuf,
)
from fai.utils.website.crawler import DocumentationCrawler
from fai.utils.website.models import WebsiteCrawlConfig


async def crawl_website_job(
    job_id: str,
    source_id: str,
    domain: str,
    config: WebsiteCrawlConfig,
) -> None:
    """
    Background job to crawl a website and index its pages.
    Handles all status updates for the IndexSourceDb record.
    """
    pages_indexed = 0
    pages_failed = 0

    try:
        LOGGER.info(f"Starting website crawl job {job_id} for domain: {domain}, base_url: {config.base_url}")

        # Create database session for the crawl operation
        async with async_session_maker() as db:
            # Delete existing pages for this base_url
            delete_stmt = delete(WebsiteDb).where(
                WebsiteDb.domain == domain,
                WebsiteDb.base_url == config.base_url,
            )
            result = await db.execute(delete_stmt)
            deleted_count = result.rowcount

            LOGGER.info(f"Deleted {deleted_count} existing pages for {config.base_url} before indexing")
            await db.commit()

            # Create and run crawler
            crawler = DocumentationCrawler(
                start_url=config.base_url,
                domain_filter=config.domain_filter,
                path_filter=config.path_filter,
                url_pattern=config.url_pattern,
                chunk_size=config.chunk_size,
                chunk_overlap=config.chunk_overlap,
                min_content_length=config.min_content_length,
            )

            loop = asyncio.get_event_loop()
            chunks = await loop.run_in_executor(
                None, lambda: crawler.crawl(max_pages=config.max_pages, delay=config.delay, verbose=True)
            )

            LOGGER.info(f"Crawled {len(chunks)} chunks from {config.base_url}")

        website_ids = []
        for chunk in chunks:
            try:
                chunk_id = str(uuid.uuid4())

                metadata = chunk.metadata
                page_url = metadata.get("url")
                document_title = metadata.get("document_title")

                keywords_val = metadata.get("keywords")
                keywords = None
                if keywords_val and isinstance(keywords_val, str):
                    keywords = [k.strip() for k in keywords_val.split(",") if k.strip()]

                website_entry = WebsiteDb(
                    id=chunk_id,
                    domain=domain,
                    base_url=config.base_url,
                    page_url=str(page_url) if page_url else config.base_url,
                    chunk=chunk.content,
                    document=chunk.full_document,
                    title=str(document_title) if document_title else None,
                    version=config.version,
                    product=config.product,
                    keywords=keywords,
                    authed=config.authed,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )

                db.add(website_entry)
                website_ids.append(chunk_id)
                pages_indexed += 1

            except Exception as e:
                LOGGER.error(f"Failed to create WebsiteDb entry for chunk: {e}")
                pages_failed += 1

        pages_failed += len(crawler.failed_urls)

        LOGGER.info(f"Created {pages_indexed} WebsiteDb entries, {pages_failed} failed")

        await db.commit()
        await sync_websites_to_tpuf(domain, website_ids, db)
        await sync_websites_to_query_index(domain, website_ids, get_website_index_name(), get_query_index_name())

        # Get a fresh database session after long-running Turbopuffer sync
        async with async_session_maker() as fresh_db:
            result = await fresh_db.execute(select(IndexSourceDb).where(IndexSourceDb.id == source_id))
            index_source = result.scalar_one_or_none()

            if index_source:
                index_source.status = "active"
                index_source.last_indexed_at = datetime.now(UTC)
                index_source.updated_at = datetime.now(UTC)

                index_source.metrics = {
                    "pages_indexed": pages_indexed,
                    "pages_failed": pages_failed,
                }

                await fresh_db.commit()

        LOGGER.info(f"Completed website crawl job {job_id} for domain: {domain}")

    except Exception:
        LOGGER.exception(f"Failed to complete website crawl job {job_id}")

        # Get a fresh database session in case of failure
        async with async_session_maker() as fresh_db:
            result = await fresh_db.execute(select(IndexSourceDb).where(IndexSourceDb.id == source_id))
            index_source = result.scalar_one_or_none()

            if index_source:
                index_source.status = "failed"
                index_source.updated_at = datetime.now(UTC)

                index_source.metrics = {
                    "pages_indexed": pages_indexed,
                    "pages_failed": pages_failed,
                }

                await fresh_db.commit()
