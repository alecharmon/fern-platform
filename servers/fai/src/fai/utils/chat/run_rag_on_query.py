from typing import List

from openai import AsyncOpenAI
from turbopuffer import AsyncTurbopuffer

from src.fai.utils.index.get_tbuf_namespace import get_docs_tbuf_namespace
from src.settings import CONFIG
from src.settings import VARIABLES


async def run_rag_on_query(query: str, domain: str) -> List[str]:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tbuf_client:
            vector = await openai_client.embeddings.create(
                input=query,
                model=CONFIG.DEFAULT_EMBEDDING_MODEL.model_name,
            )
            namespace = get_docs_tbuf_namespace(domain)
            tbuf_ns = tbuf_client.namespace(namespace)
            query_results = await tbuf_ns.query(
                rank_by=("vector", "ANN", vector.data[0].embedding),
                top_k=5,
                include_attributes=["document"],
            )
            return [result.document for result in query_results.rows]
