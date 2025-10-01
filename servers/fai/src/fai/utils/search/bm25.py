from turbopuffer import AsyncTurbopuffer

from fai.settings import (
    CONFIG,
    VARIABLES,
)
from fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_tpuf_namespace,
)


async def bm25_search(query: str, domain: str, top_k: int = 5) -> list[str]:
    """
    Perform BM25 search using Turbopuffer keyword search.

    Args:
        query: The search query/keywords
        domain: The domain to search in
        top_k: Number of results to return

    Returns:
        List of document chunks matching the keywords
    """
    if len(query) >= 1024:
        return []

    async with AsyncTurbopuffer(
        region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
        api_key=VARIABLES.TURBOPUFFER_API_KEY,
    ) as tpuf_client:
        query_index_name = get_query_index_name()
        namespace = get_tpuf_namespace(domain, query_index_name)
        tpuf_ns = tpuf_client.namespace(namespace)

        bm25_res = await tpuf_ns.query(
            top_k=top_k,
            include_attributes=["document"],
            rank_by=(
                "Sum",
                [
                    ("title", "BM25", query),
                    ("keywords", "BM25", query),
                ],
            ),
        )

        documents = []
        for row in bm25_res.rows:
            document = row.document
            if document:
                documents.append(document)

        return documents
