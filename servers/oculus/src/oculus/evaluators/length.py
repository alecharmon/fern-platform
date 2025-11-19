from typing import Any

import tiktoken

from oculus.framework.evaluators import (
    NumericEvaluationResult,
    register_evaluator,
)


def count_tokens(text: str, model: str = "claude-sonnet-4-5-20250929") -> int:
    """Count the number of tokens in text using tiktoken."""
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))


@register_evaluator("length")
def evaluate_length(
    answer: str,
    model: str = "claude-sonnet-4-5-20250929",
    **kwargs: Any,
) -> NumericEvaluationResult | None:
    """Evaluate the length (token count) of an answer."""
    if not answer:
        return None

    token_count = count_tokens(answer, model)

    return NumericEvaluationResult(
        value=float(token_count),
        reason=f"Answer contains {token_count} tokens",
        metadata={
            "evaluator": "length",
            "token_count": str(token_count),
        },
    )
