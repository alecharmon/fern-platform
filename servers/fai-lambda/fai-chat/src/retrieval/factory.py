import os
from functools import lru_cache

from src.embeddings.factory import get_embeddings_generator

from .turbopuffer_retriever import TurbopufferRetriever


@lru_cache(maxsize=1)
def get_retriever() -> TurbopufferRetriever:
    turbopuffer_api_key = os.environ["TURBOPUFFER_API_KEY"]
    region = os.environ.get("TURBOPUFFER_REGION", "gcp-us-east4")

    embeddings_generator = get_embeddings_generator()

    return TurbopufferRetriever(
        turbopuffer_api_key=turbopuffer_api_key,
        embeddings_generator=embeddings_generator,
        region=region,
    )
