import json
from typing import Any

from oculus.framework.evaluators import (
    BinaryEvaluationResult,
    register_evaluator,
)


def normalize_url(url: str) -> str:
    """Normalize URL for comparison by removing protocol, trailing slashes, and fragments."""
    normalized = url.lower().strip()

    for protocol in ["https://", "http://", "//"]:
        if normalized.startswith(protocol):
            normalized = normalized[len(protocol) :]
            break

    normalized = normalized.rstrip("/")

    if "#" in normalized:
        normalized = normalized.split("#")[0]

    return normalized


def check_citations_match(
    expected_citations: list[str],
    normalized_urls_set: set[str],
) -> tuple[list[str], list[str]]:
    found_citations = []
    missing_citations = []

    for expected in expected_citations:
        if normalize_url(expected) in normalized_urls_set:
            found_citations.append(expected)
        else:
            missing_citations.append(expected)

    return found_citations, missing_citations


@register_evaluator("citation")
def evaluate_citation(
    expected_citations: list[str] | None = None,
    actual_sources: list[dict[str, str | None]] | None = None,
    **kwargs: Any,
) -> BinaryEvaluationResult | None:
    if not expected_citations or not actual_sources:
        return None

    normalized_urls_set = {normalize_url(url) for s in actual_sources if (url := s.get("url")) and isinstance(url, str)}

    found_citations, missing_citations = check_citations_match(expected_citations, normalized_urls_set)

    is_correct = len(missing_citations) == 0

    if is_correct:
        reason = f"All {len(expected_citations)} expected citation(s) found"
    else:
        reason = (
            f"Missing {len(missing_citations)}/{len(expected_citations)} citation(s): "
            f"{', '.join(missing_citations)}"
        )

    metadata = {
        "evaluator": "citation",
        "expected_citations": json.dumps(expected_citations),
        "found_citations": json.dumps(found_citations),
        "missing_citations": json.dumps(missing_citations),
        "actual_sources": json.dumps([s.get("url") or s.get("slug") or s.get("title") for s in actual_sources]),
    }

    return BinaryEvaluationResult(
        is_correct=is_correct,
        reason=reason,
        metadata=metadata,
    )
