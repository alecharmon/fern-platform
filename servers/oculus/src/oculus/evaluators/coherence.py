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
{criteria_section}
{rating_scale}

Provide:
- score (1-3)
- reason (1-2 sentences)"""


def evaluate_answer_coherence(
    question: str,
    answer: str,
    model: str = "claude-sonnet-4-5-20250929",
    criteria: list[str] | None = None,
) -> CoherenceEvaluationResponse | None:
    if criteria and len(criteria) > 0:
        criteria_text = "\n".join(f"- {c}" for c in criteria)
        criteria_section = (
            f"\n\nIMPORTANT: The answer must also meet ALL of the following required criteria to score "
            f"well:\n{criteria_text}\n"
        )
        rating_scale = """3 - Excellent: Clear, logical structure with smooth flow and meets all criteria
2 - Acceptable: Understandable but somewhat disjointed or missing some criteria
1 - Poor: Incoherent, contradictory, nonsensical, or fails to meet criteria"""
    else:
        criteria_section = ""
        rating_scale = """3 - Excellent: Clear, logical structure with smooth flow
2 - Acceptable: Understandable but somewhat disjointed
1 - Poor: Incoherent, contradictory, or nonsensical"""

    return generate_with_claude(
        response_type=CoherenceEvaluationResponse,
        prompt_template=COHERENCE_EVALUATION_PROMPT_TEMPLATE,
        model=model,
        question=question,
        answer=answer,
        criteria_section=criteria_section,
        rating_scale=rating_scale,
    )


@register_evaluator("coherence")
def evaluate_coherence(
    question: str,
    answer: str,
    ground_truth: str,
    model: str = "claude-sonnet-4-5-20250929",
    **kwargs: Any,
) -> ScaledEvaluationResult | None:
    criteria = kwargs.get("criteria")
    response = evaluate_answer_coherence(question, answer, model, criteria=criteria)

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
