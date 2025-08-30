from turbopuffer import AsyncTurbopuffer

from src.fai.models.enums.index_names import DataIndexNames
from src.fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_tpuf_namespace,
)
from src.fai.utils.turbopuffer.sync import sync_index_to_target
from src.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)


async def reconstruct_query_index_for_domain(domain: str) -> None:
    query_namespace_id = get_tpuf_namespace(domain, get_query_index_name())
    LOGGER.info(f"Reconstructing index {query_namespace_id} for domain {domain}")
    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        query_namespace = tpuf_client.namespace(query_namespace_id)
        try:
            await query_namespace.delete_all()
        except Exception:
            LOGGER.info(f"No index to delete from {query_namespace_id}")
        for index_name in DataIndexNames:
            try:
                await sync_index_to_target(domain, index_name.value, get_query_index_name())
            except Exception:
                LOGGER.info(f"No index to sync from {index_name.value}")
