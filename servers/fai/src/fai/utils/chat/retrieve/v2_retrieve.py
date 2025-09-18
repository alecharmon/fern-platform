from collections.abc import Iterable
from typing import Any

from openai import AsyncOpenAI
from turbopuffer import AsyncTurbopuffer

from src.fai.utils.as_dict import as_dict
from src.fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_tpuf_namespace,
)
from src.settings import (
    CONFIG,
    VARIABLES,
)

DOCUMENT_ATTRIBUTES = ["document", "chunk", "url", "version", "title", "keywords"]


class TPUFRow:
    def __init__(self, id: str, score: float | None, attributes: dict[str, Any]):
        self.id = id
        self.score = score
        self.attributes = attributes

    @property
    def document(self) -> str | None:
        return self.attributes.get("document")

    @property
    def chunk(self) -> str | None:
        return self.attributes.get("chunk")

    @property
    def url(self) -> str | None:
        return self.attributes.get("url")


def _normalize_rows(rows: Iterable[Any]) -> list[TPUFRow]:
    norm: list[TPUFRow] = []
    for r in rows:
        _id = getattr(r, "id", None)
        _score = getattr(r, "score", None)

        attrs = {}
        cand = getattr(r, "attributes", None)
        if isinstance(cand, dict):
            attrs.update(cand)
        cand = getattr(r, "payload", None)
        if isinstance(cand, dict):
            attrs.update(cand)

        if not attrs:
            dumped = as_dict(r)
            for k in ("attributes", "payload"):
                v = dumped.get(k)
                if isinstance(v, dict):
                    attrs.update(v)
            for k in DOCUMENT_ATTRIBUTES:
                if k in dumped and k not in attrs:
                    attrs[k] = dumped[k]

        if _id is None:
            _id = as_dict(r).get("id")
        if _score is None:
            _score = as_dict(r).get("score")

        norm.append(TPUFRow(id=str(_id), score=_score, attributes=attrs or {}))
    return norm


def _results_to_ranks(items: list[TPUFRow]) -> dict[str, int]:
    ranks: dict[str, int] = {}
    for i, it in enumerate(items, start=1):
        if it and it.id is not None and it.id not in ranks:
            ranks[it.id] = i
    return ranks


def _rrf(bm25: list[TPUFRow], vector: list[TPUFRow], k: int = 60) -> list[TPUFRow]:
    by_id: dict[str, TPUFRow] = {it.id: it for it in bm25}
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

    results: list[TPUFRow] = []
    for _id in fused:
        row = by_id[_id]
        row.score = scores[_id]
        results.append(row)

    return results


def _build_filters(
    filters: list[dict[str, str]] | None,
    document_ids_to_ignore: list[str] | None,
    urls_to_ignore: list[str] | None,
) -> Any | None:
    """Build TPUF-compatible filter expression mirroring the TS logic."""
    document_ids_to_ignore = document_ids_to_ignore or []
    urls_to_ignore = urls_to_ignore or []
    filters = filters or []

    doc_id_filters: list[Any] = [["id", "NotEq", _id] for _id in document_ids_to_ignore]
    url_filters: list[Any] = [["url", "NotEq", u] for u in urls_to_ignore]

    version_filters = [f for f in filters if f.get("facet") == "version.title"]
    version_conds: list[Any] = [["version", "Eq", f["value"]] for f in version_filters if "value" in f]

    if version_conds:
        return ["And", [*version_conds, *doc_id_filters, *url_filters]]
    elif doc_id_filters or url_filters:
        all_filters = [*doc_id_filters, *url_filters]
        return all_filters[0] if len(all_filters) == 1 else ["And", all_filters]

    else:
        return None


async def v2_retrieve(
    query: str,
    domain: str,
    *,
    top_k: int = 5,
    mode: str = "hybrid",  # "semantic" | "bm25" | "hybrid"
    filters: list[dict[str, str]] | None = None,
    document_ids_to_ignore: list[str] | None = None,
    urls_to_ignore: list[str] | None = None,
) -> list[TPUFRow]:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            query_index_name = get_query_index_name()
            namespace = get_tpuf_namespace(domain, query_index_name)
            tpuf_ns = tpuf_client.namespace(namespace)

            query_filters = _build_filters(filters, document_ids_to_ignore, urls_to_ignore)

            semantic_rows: list[TPUFRow] = []
            bm25_rows: list[TPUFRow] = []

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
                semantic_rows = _normalize_rows(getattr(sem_res, "rows", []))

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
                bm25_rows = _normalize_rows(getattr(bm25_res, "rows", []))

            if mode == "semantic":
                fused = semantic_rows
            elif mode == "bm25":
                fused = bm25_rows
            else:
                fused = _rrf(bm25_rows, semantic_rows, k=60)

            results: list[Any] = []
            for row in fused:
                results.append(row)

            return results
