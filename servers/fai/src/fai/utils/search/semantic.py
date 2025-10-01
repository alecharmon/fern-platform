from openai import AsyncOpenAI
from turbopuffer import AsyncTurbopuffer

from fai.settings import (
    CONFIG,
    VARIABLES,
)
from fai.utils.turbopuffer.namespace import (
    get_query_index_name,
    get_tpuf_namespace,
)


async def semantic_search(query: str, domain: str, top_k: int = 5) -> list[str]:
    """
    Perform semantic search using Turbopuffer vector search.

    Args:
        query: The search query
        domain: The domain to search in
        top_k: Number of results to return

    Returns:
        List of document chunks matching the query
    """
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
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

            query_index_name = get_query_index_name()
            namespace = get_tpuf_namespace(domain, query_index_name)
            tpuf_ns = tpuf_client.namespace(namespace)

            sem_res = await tpuf_ns.query(
                top_k=top_k,
                include_attributes=["document"],
                rank_by=("vector", "ANN", embedding),
            )

            documents = []
            for row in sem_res.rows:
                document = row.document
                if document:
                    documents.append(document)

            return documents
