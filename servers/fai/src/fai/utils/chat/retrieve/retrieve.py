from openai import AsyncOpenAI
from turbopuffer import AsyncTurbopuffer
from turbopuffer.types.row import Row

from fai.settings import (
    CONFIG,
    VARIABLES,
)
from fai.utils.chat.filters import build_filters
from fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_tpuf_namespace,
)

DOCUMENT_ATTRIBUTES = ["chunk", "document", "url", "version", "product", "roles", "title", "keywords"]


def _results_to_ranks(items: list[Row]) -> dict[str, int]:
    ranks: dict[str, int] = {}
    for i, it in enumerate(items, start=1):
        if it and it.id is not None and it.id not in ranks:
            ranks[it.id] = i
    return ranks


def _rrf(bm25: list[Row], vector: list[Row], k: int = 60) -> list[Row]:
    by_id: dict[str, Row] = {it.id: it for it in bm25}
    by_id.update({it.id: it for it in vector})

    bm25_ranks = _results_to_ranks(bm25)
    vec_ranks = _results_to_ranks(vector)

    scores: dict[str, float] = {}
    all_ids = set(bm25_ranks.keys()) | set(vec_ranks.keys())

    for doc_id in all_ids:
        rb = bm25_ranks.get(doc_id, float("inf"))
        rv = vec_ranks.get(doc_id, float("inf"))
        scores[doc_id] = (1.0 / (k + rb)) + (1.0 / (k + rv))

    fused = sorted(all_ids, key=lambda _id: scores[_id], reverse=True)

    results: list[Row] = []
    for _id in fused:
        row = by_id[_id]
        row.score = scores[_id]
        results.append(row)

    return results


async def retrieve(
    query: str,
    domain: str,
    *,
    top_k: int = 5,
    mode: str = "hybrid",  # "semantic" | "bm25" | "hybrid"
    filters: list[dict[str, str]] | None = None,
    exploded_roles: list[str] | None = None,
) -> list[Row]:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            query_index_name = get_query_index_name()
            namespace = get_tpuf_namespace(domain, query_index_name)
            tpuf_ns = tpuf_client.namespace(namespace)

            query_filters = build_filters(
                filters=filters,
                exploded_roles=exploded_roles,
            )

            semantic_rows: list[Row] = []
            bm25_rows: list[Row] = []

            if mode != "bm25":
                embedding = (
                    (
                        await openai_client.embeddings.create(
                            input=query,
                            model=CONFIG.DEFAULT_EMBEDDING_MODEL.model_name,
                        )
                    )
                    .data[0]
                    .embedding
                )

                sem_res = await tpuf_ns.query(
                    top_k=top_k,
                    filters=query_filters,
                    include_attributes=DOCUMENT_ATTRIBUTES,
                    rank_by=("vector", "ANN", embedding),
                )
                semantic_rows = getattr(sem_res, "rows", [])

            if mode != "semantic" and len(query) < 1024:
                bm25_res = await tpuf_ns.query(
                    top_k=top_k,
                    filters=query_filters,
                    include_attributes=DOCUMENT_ATTRIBUTES,
                    rank_by=(
                        "Sum",
                        [
                            ("title", "BM25", query),
                            ("keywords", "BM25", query),
                        ],
                    ),
                )
                bm25_rows = getattr(bm25_res, "rows", [])

            if mode == "semantic":
                fused = semantic_rows
            elif mode == "bm25":
                fused = bm25_rows
            else:
                fused = _rrf(bm25_rows, semantic_rows, k=60)

            return fused[:top_k]
