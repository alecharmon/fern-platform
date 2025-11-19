"""Abstract factory interface for creating LLM providers."""

from abc import (
    ABC,
    abstractmethod,
)

from .base import LLMProvider


class ProviderFactory(ABC):
    @abstractmethod
    def create(
        self,
        model: str,
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> LLMProvider | None:
        pass

    @abstractmethod
    def is_available(self) -> bool:
        pass

    @abstractmethod
    def get_supported_models(self) -> dict[str, str]:
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass
