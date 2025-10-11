from datetime import (
    UTC,
    datetime,
    timedelta,
)

from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from turbopuffer import AsyncTurbopuffer

from fai.models.db.settings_db import SettingsDb
from fai.models.enums.index_names import (
    QUERY_INDEX_NAME,
    DataIndexNames,
)
from fai.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)
from fai.utils.turbopuffer.namespace import get_tpuf_namespace


async def delete_turbopuffer_namespaces_for_domain(domain: str) -> None:
    """Delete all turbopuffer namespaces associated with a domain."""
    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        for index_name in DataIndexNames:
            namespace_id = get_tpuf_namespace(domain, index_name.value)
            try:
                namespace = tpuf_client.namespace(namespace_id)
                await namespace.delete_all()
                LOGGER.info(f"Deleted turbopuffer namespace: {namespace_id}")
            except Exception as e:
                LOGGER.warning(f"Failed to delete namespace {namespace_id}: {e}")

        query_namespace_id = get_tpuf_namespace(domain, QUERY_INDEX_NAME)
        try:
            query_namespace = tpuf_client.namespace(query_namespace_id)
            await query_namespace.delete_all()
            LOGGER.info(f"Deleted turbopuffer namespace: {query_namespace_id}")
        except Exception as e:
            LOGGER.warning(f"Failed to delete namespace {query_namespace_id}: {e}")


async def cleanup_preview_settings(db: AsyncSession) -> dict[str, int | list[str]]:
    """
    Clean up preview settings that are older than 1 day.
    Returns a dict with the count of deleted settings and their domains.
    """
    cutoff_time = datetime.now(UTC) - timedelta(days=1)

    query = select(SettingsDb).where(SettingsDb.is_preview == True, SettingsDb.created_time < cutoff_time)  # noqa: E712

    result = await db.execute(query)
    preview_settings_to_delete = result.scalars().all()

    deleted_domains = []
    deleted_count = 0

    for setting in preview_settings_to_delete:
        domain = setting.domain
        try:
            await delete_turbopuffer_namespaces_for_domain(domain)

            delete_query = delete(SettingsDb).where(SettingsDb.domain == domain)
            await db.execute(delete_query)

            await db.commit()

            deleted_domains.append(domain)
            deleted_count += 1

            LOGGER.info(f"Cleaned up preview setting for domain: {domain}")

        except Exception as e:
            await db.rollback()
            LOGGER.exception(f"Failed to cleanup preview setting for domain {domain}: {e}")

    LOGGER.info(
        f"Preview settings cleanup completed: {deleted_count} preview settings deleted, "
        f"cutoff time: {cutoff_time.isoformat()}"
    )

    return {"deleted_count": deleted_count, "deleted_domains": deleted_domains}
