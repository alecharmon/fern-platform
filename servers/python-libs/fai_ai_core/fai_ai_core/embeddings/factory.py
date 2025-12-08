import os
from functools import lru_cache

from .openai_generator import OpenAIEmbeddingsGenerator


@lru_cache(maxsize=1)
def get_embeddings_generator() -> OpenAIEmbeddingsGenerator:
    api_key = os.environ["OPENAI_API_KEY"]
    return OpenAIEmbeddingsGenerator(api_key=api_key)
