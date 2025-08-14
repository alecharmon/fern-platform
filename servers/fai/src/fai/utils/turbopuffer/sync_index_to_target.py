import hashlib

from turbopuffer import NOT_GIVEN
from turbopuffer import AsyncTurbopuffer
from turbopuffer.types.row import Row

from settings import CONFIG
from settings import LOGGER
from settings import VARIABLES
from src.fai.utils.index.get_tpuf_namespace import get_tpuf_namespace
from src.fai.utils.turbopuffer.schemas import get_query_index_tpuf_schema


def prefixed_id(namespace: str, original_id: str, max_len: int = 64) -> str:
    new_id = f"{namespace}:{original_id}"
    if len(new_id.encode("utf-8")) <= max_len:
        return new_id
    hashed = hashlib.sha256(original_id.encode("utf-8")).hexdigest()[:16]
    short_ns = namespace[: max_len - len(hashed) - 1]
    return f"{short_ns}:{hashed}"


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
