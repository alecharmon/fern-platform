from dataclasses import dataclass


@dataclass
class RequestMetrics:
    request_received_ms: float
    retrieval_start_ms: float
    retrieval_end_ms: float
    llm_start_ms: float
    first_token_ms: float | None
    llm_end_ms: float
    input_tokens: int
    output_tokens: int
    query_decomposition_ms: float | None = None

    @property
    def ttft_ms(self) -> float | None:
        if self.first_token_ms is None:
            return None
        return self.first_token_ms - self.request_received_ms

    @property
    def retrieval_time_ms(self) -> float:
        return self.retrieval_end_ms - self.retrieval_start_ms

    @property
    def total_llm_time_ms(self) -> float:
        return self.llm_end_ms - self.llm_start_ms

    @property
    def total_request_time_ms(self) -> float:
        return self.llm_end_ms - self.request_received_ms

    def to_dict(self) -> dict[str, float | int | None]:
        return {
            "ttft_ms": self.ttft_ms,
            "retrieval_time_ms": self.retrieval_time_ms,
            "query_decomposition_ms": self.query_decomposition_ms,
            "total_llm_time_ms": self.total_llm_time_ms,
            "total_request_time_ms": self.total_request_time_ms,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
        }
