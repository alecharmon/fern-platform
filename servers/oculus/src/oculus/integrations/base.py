import json
from collections.abc import Callable
from typing import Protocol, TypedDict


class SourceMetadata(TypedDict, total=False):
    """Normalized source metadata across integrations."""

    title: str | None
    url: str | None
    slug: str | None


class AnswerMetadata(TypedDict, total=False):
    """
    Common metadata structure for all integrations.

    Required fields:
    - integration_type: The type of integration used
    - model: The model used to generate the answer
    - sources: List of source documents used

    Optional fields:
    - fai_local_retrieved_documents: Full JSON with retrieval scores (FAI local only)
    - fai_http_citations: List of citation URLs (FAI HTTP only)
    - vercel_query_id: Query tracking ID (Vercel only)
    - vercel_tool_calls: Number of tool calls made (Vercel only)
    - response_time_ms: Time taken to generate response
    """

    # Required
    integration_type: str
    model: str
    sources: list[SourceMetadata]

    # Optional - Integration-specific
    fai_local_retrieved_documents: str
    fai_http_citations: list[str]
    vercel_query_id: str
    vercel_tool_calls: int

    # Optional - Timing
    response_time_ms: float


class AnswerIntegration(Protocol):
    """Protocol for generating answers from different sources."""

    def generate_answer(self, question: str) -> tuple[str, AnswerMetadata]:
        """
        Generate an answer for the given question.

        Args:
            question: The question to answer

        Returns:
            A tuple of (answer_text, metadata)
            - answer_text: The generated answer
            - metadata: Metadata about the answer following AnswerMetadata schema
        """
        ...


def create_answer_function(
    integration: AnswerIntegration,
) -> Callable[[str], tuple[str, dict[str, str]]]:
    """Helper to create a simple callable from an integration."""

    def answer_fn(question: str) -> tuple[str, dict[str, str]]:
        answer, metadata = integration.generate_answer(question)
        result = {}
        for k, v in metadata.items():
            if isinstance(v, list | dict):
                result[k] = json.dumps(v)
            else:
                result[k] = str(v)
        return answer, result

    return answer_fn
