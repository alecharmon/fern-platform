import time
from typing import Any

from turbopuffer import AsyncTurbopuffer

from ..embeddings.interface import (
    EmbeddingError,
    EmbeddingsGenerator,
)
from .filters import QueryFilters
from .interface import (
    RAGRetriever,
    RetrievalQuery,
    RetrievalResult,
    RetrievalStrategy,
    RetrievedDocument,
    TimingBreakdown,
    VectorStoreError,
)
from .turbopuffer_query_filters import TurbopufferFilter, build_turbopuffer_filters

TURBOPUFFER_INCLUDE_ATTRIBUTES = ["document", "title", "url", "id"]


class TurbopufferRetriever(RAGRetriever):
    def __init__(
        self,
        *,
        turbopuffer_api_key: str,
        embeddings_generator: EmbeddingsGenerator,
        region: str,
    ):
        self.turbopuffer_api_key = turbopuffer_api_key
        self.embeddings_generator = embeddings_generator
        self.region = region
        self._client = AsyncTurbopuffer(
            api_key=turbopuffer_api_key,
            region=region,
        )

    async def __aenter__(self) -> "TurbopufferRetriever":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()

    async def retrieve(self, query: RetrievalQuery) -> RetrievalResult:
        start_time = time.time()

        try:
            if query.strategy == RetrievalStrategy.SEMANTIC:
                documents, timing = await self._semantic_retrieve(query)
            elif query.strategy == RetrievalStrategy.BM25:
                documents, timing = await self._bm25_retrieve(query)
            elif query.strategy == RetrievalStrategy.HYBRID:
                documents, timing = await self._hybrid_retrieve(query)
            else:
                raise ValueError(f"Unsupported strategy: {query.strategy}")

            retrieval_time_ms = (time.time() - start_time) * 1000

            result = RetrievalResult(
                documents=documents,
                query=query,
                retrieval_time_ms=retrieval_time_ms,
                total_results=len(documents),
                timing=timing,
            )

            if query.min_score is not None:
                result = result.filter_by_score(query.min_score)

            return result

        except EmbeddingError:
            raise
        except Exception as e:
            raise VectorStoreError(f"Retrieval failed: {str(e)}") from e

    async def batch_retrieve(self, queries: list[RetrievalQuery]) -> list[RetrievalResult]:
        if not queries:
            return []

        if len(queries) > 16:
            raise ValueError("Cannot batch retrieve more than 16 queries at once")

        start_time = time.time()
        first_query = queries[0]

        query_texts = [q.query for q in queries]
        embeddings = await self.embeddings_generator.generate_batch(query_texts)

        try:
            namespace = self._get_namespace(first_query.domain)
            tpuf_ns = self._client.namespace(namespace)

            multiquery_response = await tpuf_ns.multi_query(
                queries=[
                    {
                        "top_k": q.top_k,
                        "include_attributes": TURBOPUFFER_INCLUDE_ATTRIBUTES,
                        "rank_by": ("vector", "ANN", emb),
                        "filters": self._build_filters(q.filters),
                    }
                    for q, emb in zip(queries, embeddings)
                ]
            )

            retrieval_time_ms = (time.time() - start_time) * 1000

            results = []
            for i, (query, tpuf_result) in enumerate(zip(queries, multiquery_response.results)):
                documents = self._parse_turbopuffer_results(tpuf_result)

                result = RetrievalResult(
                    documents=documents,
                    query=query,
                    retrieval_time_ms=retrieval_time_ms,
                    total_results=len(documents),
                )

                if query.min_score is not None:
                    result = result.filter_by_score(query.min_score)

                results.append(result)

            return results

        except Exception as e:
            raise VectorStoreError(f"Batch retrieval failed: {str(e)}") from e

    async def _semantic_retrieve(self, query: RetrievalQuery) -> tuple[list[RetrievedDocument], TimingBreakdown]:
        embed_start = time.time()
        embedding = await self.embeddings_generator.generate(query.query)
        embed_time = (time.time() - embed_start) * 1000

        query_start = time.time()
        namespace = self._get_namespace(query.domain)
        tpuf_ns = self._client.namespace(namespace)

        result = await tpuf_ns.query(
            top_k=query.top_k,
            include_attributes=TURBOPUFFER_INCLUDE_ATTRIBUTES,
            rank_by=("vector", "ANN", embedding),
            filters=self._build_filters(query.filters),
        )
        query_time = (time.time() - query_start) * 1000

        timing = TimingBreakdown(
            embedding_ms=embed_time,
            query_ms=query_time,
            total_ms=embed_time + query_time,
        )

        return self._parse_turbopuffer_results(result), timing

    async def _bm25_retrieve(self, query: RetrievalQuery) -> tuple[list[RetrievedDocument], TimingBreakdown]:
        query_start = time.time()
        namespace = self._get_namespace(query.domain)
        tpuf_ns = self._client.namespace(namespace)

        result = await tpuf_ns.query(
            top_k=query.top_k,
            include_attributes=TURBOPUFFER_INCLUDE_ATTRIBUTES,
            rank_by=(
                "Sum",
                [
                    ("title", "BM25", query.query),
                    ("keywords", "BM25", query.query),
                ],
            ),
            filters=self._build_filters(query.filters),
        )
        query_time = (time.time() - query_start) * 1000

        timing = TimingBreakdown(
            query_ms=query_time,
            total_ms=query_time,
        )

        return self._parse_turbopuffer_results(result), timing

    async def _hybrid_retrieve(self, query: RetrievalQuery) -> tuple[list[RetrievedDocument], TimingBreakdown]:
        embed_start = time.time()
        embedding = await self.embeddings_generator.generate(query.query)
        embed_time = (time.time() - embed_start) * 1000

        query_start = time.time()
        namespace = self._get_namespace(query.domain)
        tpuf_ns = self._client.namespace(namespace)

        filters = self._build_filters(query.filters)
        multiquery_response = await tpuf_ns.multi_query(
            queries=[
                {
                    "top_k": query.top_k * 2,
                    "include_attributes": TURBOPUFFER_INCLUDE_ATTRIBUTES,
                    "rank_by": ("vector", "ANN", embedding),
                    "filters": filters,
                },
                {
                    "top_k": query.top_k * 2,
                    "include_attributes": TURBOPUFFER_INCLUDE_ATTRIBUTES,
                    "rank_by": (
                        "Sum",
                        [
                            ("title", "BM25", query.query),
                            ("keywords", "BM25", query.query),
                        ],
                    ),
                    "filters": filters,
                },
            ]
        )
        query_time = (time.time() - query_start) * 1000

        rerank_start = time.time()
        semantic_docs = self._parse_turbopuffer_results(multiquery_response.results[0])
        bm25_docs = self._parse_turbopuffer_results(multiquery_response.results[1])
        fused_docs = self._reciprocal_rank_fusion(semantic_docs, bm25_docs, k=query.top_k)
        rerank_time = (time.time() - rerank_start) * 1000

        timing = TimingBreakdown(
            embedding_ms=embed_time,
            query_ms=query_time,
            rerank_ms=rerank_time,
            total_ms=embed_time + query_time + rerank_time,
        )

        return fused_docs, timing

    async def warm_cache(self, domain: str) -> None:
        namespace = self._get_namespace(domain)
        tpuf_ns = self._client.namespace(namespace)
        await tpuf_ns.hint_cache_warm()

    async def close(self) -> None:
        await self._client.close()

    def _get_namespace(self, domain: str) -> str:
        return f"{domain}_query"

    def _build_filters(self, filters: QueryFilters | None) -> TurbopufferFilter | None:
        if not filters:
            return None

        return build_turbopuffer_filters(filters)

    def _parse_turbopuffer_results(self, result: Any) -> list[RetrievedDocument]:
        documents: list[RetrievedDocument] = []
        if not result.rows:
            return documents

        for row in result.rows:
            if not hasattr(row, "document") or not row.document:
                continue

            metadata = {}
            if hasattr(row, "title") and row.title:
                metadata["title"] = row.title
            if hasattr(row, "url") and row.url:
                metadata["url"] = row.url

            score = getattr(row, "$dist", 0.0)

            documents.append(
                RetrievedDocument(
                    content=row.document,
                    score=score,
                    metadata=metadata if metadata else None,
                    document_id=str(row.id),
                )
            )

        return documents

    def _reciprocal_rank_fusion(
        self,
        list1: list[RetrievedDocument],
        list2: list[RetrievedDocument],
        k: int,
        rrf_k: int = 60,
    ) -> list[RetrievedDocument]:
        scores: dict[str, tuple[float, RetrievedDocument]] = {}

        for rank, doc in enumerate(list1, start=1):
            assert doc.document_id is not None, "Document ID must be present for RRF"
            rrf_score = 1.0 / (rrf_k + rank)
            scores[doc.document_id] = (rrf_score, doc)

        for rank, doc in enumerate(list2, start=1):
            assert doc.document_id is not None, "Document ID must be present for RRF"
            rrf_score = 1.0 / (rrf_k + rank)
            if doc.document_id in scores:
                scores[doc.document_id] = (scores[doc.document_id][0] + rrf_score, scores[doc.document_id][1])
            else:
                scores[doc.document_id] = (rrf_score, doc)

        sorted_docs = sorted(scores.values(), key=lambda x: x[0], reverse=True)

        result_docs = []
        for score, doc in sorted_docs[:k]:
            doc.score = score
            result_docs.append(doc)

        return result_docs
