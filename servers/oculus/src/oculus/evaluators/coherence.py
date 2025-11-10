from typing import Any

from pydantic import BaseModel

from oculus.framework.evaluators import (
    ScaledEvaluationResult,
    register_evaluator,
)
from oculus.utils.anthropic_utils import generate_with_claude


class CoherenceEvaluationResponse(BaseModel):
    score: int
    reason: str


COHERENCE_EVALUATION_PROMPT_TEMPLATE = """You are evaluating the coherence and structure of an AI assistant's answer.

Question: {question}

AI Assistant's Answer:
{answer}

Rate the coherence on a scale of 1-3 based on:
- Logical flow and organization
- Clear progression of ideas
- Absence of contradictions
- Appropriate transitions between concepts

3 - Excellent: Clear, logical structure with smooth flow
2 - Acceptable: Understandable but somewhat disjointed
1 - Poor: Incoherent, contradictory, or nonsensical

Provide:
- coherence_score (1-3)
- reasoning (1-2 sentences)"""


def evaluate_answer_coherence(
    question: str,
    answer: str,
    model: str = "claude-sonnet-4-5-20250929",
) -> CoherenceEvaluationResponse | None:
    return generate_with_claude(
        response_type=CoherenceEvaluationResponse,
        prompt_template=COHERENCE_EVALUATION_PROMPT_TEMPLATE,
        model=model,
        question=question,
        answer=answer,
    )


@register_evaluator("coherence")
def evaluate_coherence(
    question: str,
    answer: str,
    ground_truth: str,
    model: str = "claude-sonnet-4-5-20250929",
    **kwargs: Any,
) -> ScaledEvaluationResult | None:
    response = evaluate_answer_coherence(question, answer, model)

    if not response:
        return None

    return ScaledEvaluationResult(
        score=response.score,
        min_score=1,
        max_score=3,
        passing_threshold=2,
        reason=response.reason,
        metadata={"evaluator": "coherence", "judge_model": model},
    )
