"""Abstract base class for LLM providers."""

from abc import (
    ABC,
    abstractmethod,
)
from collections.abc import AsyncGenerator

from .models import (
    LLMMessage,
    LLMResponse,
    StreamEvent,
)


class LLMProvider(ABC):
    """Base interface for LLM providers."""

    @abstractmethod
    async def generate(self, messages: list[LLMMessage]) -> LLMResponse:
        """Generate a complete response (non-streaming)."""
        pass

    @abstractmethod
    async def generate_stream(self, messages: list[LLMMessage]) -> AsyncGenerator[StreamEvent, None]:
        """Generate a streaming response as SSE events."""
        if False:
            yield

    @property
    @abstractmethod
    def model_id(self) -> str:
        """Return the model identifier."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name."""
        pass
