from abc import (
    ABC,
    abstractmethod,
)
from dataclasses import dataclass
from enum import Enum
from typing import Any


class RetrievalStrategy(str, Enum):
    SEMANTIC = "semantic"
    BM25 = "bm25"
    HYBRID = "hybrid"


@dataclass
class RetrievedDocument:
    content: str
    score: float
    metadata: dict[str, Any] | None = None
    document_id: str | None = None

    def __post_init__(self) -> None:
        if not self.content:
            raise ValueError("Document content cannot be empty")


@dataclass
class RetrievalQuery:
    query: str
    domain: str
    top_k: int = 5
    strategy: RetrievalStrategy = RetrievalStrategy.HYBRID
    filters: dict[str, Any] | None = None
    min_score: float | None = None

    def __post_init__(self) -> None:
        if self.top_k <= 0:
            raise ValueError("top_k must be positive")
        if not self.query:
            raise ValueError("Query cannot be empty")


@dataclass
class TimingBreakdown:
    total_ms: float | None = None
    embedding_ms: float | None = None
    query_ms: float | None = None
    rerank_ms: float | None = None


@dataclass
class RetrievalResult:
    documents: list[RetrievedDocument]
    query: RetrievalQuery
    retrieval_time_ms: float | None = None
    total_results: int | None = None
    timing: TimingBreakdown | None = None

    @property
    def is_empty(self) -> bool:
        return len(self.documents) == 0

    def filter_by_score(self, min_score: float) -> "RetrievalResult":
        filtered_docs = [doc for doc in self.documents if doc.score >= min_score]
        return RetrievalResult(
            documents=filtered_docs,
            query=self.query,
            retrieval_time_ms=self.retrieval_time_ms,
            total_results=len(filtered_docs),
            timing=self.timing,
        )


class RAGRetriever(ABC):
    @abstractmethod
    async def retrieve(self, query: RetrievalQuery) -> RetrievalResult:
        pass

    @abstractmethod
    async def batch_retrieve(self, queries: list[RetrievalQuery]) -> list[RetrievalResult]:
        pass

    @abstractmethod
    async def warm_cache(self, domain: str) -> None:
        pass


class RetrievalError(Exception):
    pass


class VectorStoreError(RetrievalError):
    pass
