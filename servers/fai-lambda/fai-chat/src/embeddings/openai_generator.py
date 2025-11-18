from typing import Any

from openai import AsyncOpenAI

from .interface import (
    EmbeddingError,
    EmbeddingsGenerator,
)


class OpenAIEmbeddingsGenerator(EmbeddingsGenerator):
    def __init__(self, api_key: str, model: str = "text-embedding-3-large"):
        self.api_key = api_key
        self.model = model
        self._client = AsyncOpenAI(api_key=api_key)

    async def __aenter__(self) -> "OpenAIEmbeddingsGenerator":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()

    async def generate(self, text: str) -> list[float]:
        try:
            response = await self._client.embeddings.create(
                input=text,
                model=self.model,
            )
            return response.data[0].embedding
        except Exception as e:
            raise EmbeddingError(f"Failed to generate embedding: {str(e)}") from e

    async def generate_batch(self, texts: list[str]) -> list[list[float]]:
        try:
            response = await self._client.embeddings.create(
                input=texts,
                model=self.model,
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            raise EmbeddingError(f"Failed to generate embeddings: {str(e)}") from e

    async def close(self) -> None:
        await self._client.close()
