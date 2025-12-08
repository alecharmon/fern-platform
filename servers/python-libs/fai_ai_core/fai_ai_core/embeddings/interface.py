from abc import (
    ABC,
    abstractmethod,
)


class EmbeddingError(Exception):
    pass


class EmbeddingsGenerator(ABC):
    @abstractmethod
    async def generate(self, text: str) -> list[float]:
        pass

    @abstractmethod
    async def generate_batch(self, texts: list[str]) -> list[list[float]]:
        pass
