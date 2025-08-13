from typing import List

from openai import AsyncOpenAI
from turbopuffer import AsyncTurbopuffer

from src.fai.utils.index.get_tpuf_namespace import get_query_index_name
from src.fai.utils.index.get_tpuf_namespace import get_tpuf_namespace
from src.settings import CONFIG
from src.settings import VARIABLES


async def run_rag_on_query(query: str, domain: str) -> List[str]:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        async with AsyncTurbopuffer(
            region=CONFIG.TURBOPUFFER_DEFAULT_REGION,
            api_key=VARIABLES.TURBOPUFFER_API_KEY,
        ) as tpuf_client:
            vector = await openai_client.embeddings.create(
                input=query,
                model=CONFIG.DEFAULT_EMBEDDING_MODEL.model_name,
            )
            query_index_name = get_query_index_name()
            namespace = get_tpuf_namespace(domain, query_index_name)
            tpuf_ns = tpuf_client.namespace(namespace)
            query_results = await tpuf_ns.query(
                rank_by=("vector", "ANN", vector.data[0].embedding),
                top_k=5,
                include_attributes=["document"],
            )
            return [result.document for result in query_results.rows]
