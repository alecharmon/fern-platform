from abc import (
    ABC,
    abstractmethod,
)
from collections.abc import AsyncGenerator

from ..llm.models import StreamEvent
from ..models.stream import Source


class StreamProtocol(ABC):
    @abstractmethod
    def stream_chat(
        self,
        sources: list[Source],
        query_id: str,
        message_id: str,
        text_stream: AsyncGenerator[StreamEvent, None],
    ) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    def get_media_type(self) -> str:
        pass

    @abstractmethod
    def get_headers(self) -> dict[str, str]:
        pass
