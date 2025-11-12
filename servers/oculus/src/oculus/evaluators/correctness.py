from typing import Any

from pydantic import BaseModel

from oculus.framework.evaluators import (
    BinaryEvaluationResult,
    register_evaluator,
)
from oculus.utils.anthropic_utils import generate_with_claude


class EvaluationResponse(BaseModel):
    is_correct: bool
    reason: str


EVALUATION_PROMPT_TEMPLATE = """You are evaluating the correctness of an AI assistant's answer to a technical question \
about API documentation.

Question: {question}

Ground Truth / Expected Information:
{ground_truth}

AI Assistant's Answer:
{answer}

Evaluate whether the AI assistant's answer is correct and complete based on the ground truth. The answer should:
1. Accurately represent the information in the ground truth
2. Not include significant hallucinations or incorrect information
3. Address the core question being asked
{criteria_section}
{evaluation_guidance}

Provide your evaluation with a brief reason."""


def evaluate_answer(
    question: str,
    answer: str,
    ground_truth: str,
    model: str = "claude-sonnet-4-5-20250929",
    criteria: list[str] | None = None,
) -> EvaluationResponse | None:
    if criteria and len(criteria) > 0:
        criteria_text = "\n".join(f"- {c}" for c in criteria)
        criteria_section = (
            f"\n\nIMPORTANT: The answer cannot be deemed correct unless it meets ALL of the following "
            f"required criteria:\n{criteria_text}\n"
        )
        evaluation_guidance = (
            "If the answer is mostly correct with minor issues, mark it as correct. Only mark as incorrect "
            "if there are significant errors, omissions, or if it fails to meet any of the required criteria."
        )
    else:
        criteria_section = ""
        evaluation_guidance = (
            "If the answer is mostly correct with minor issues, mark it as correct. Only mark as incorrect "
            "if there are significant errors or omissions."
        )

    return generate_with_claude(
        response_type=EvaluationResponse,
        prompt_template=EVALUATION_PROMPT_TEMPLATE,
        model=model,
        question=question,
        answer=answer,
        ground_truth=ground_truth,
        criteria_section=criteria_section,
        evaluation_guidance=evaluation_guidance,
    )


@register_evaluator("correctness")
def evaluate_correctness(
    question: str,
    answer: str,
    ground_truth: str,
    model: str = "claude-sonnet-4-5-20250929",
    **kwargs: Any,
) -> BinaryEvaluationResult | None:
    criteria = kwargs.get("criteria")
    response = evaluate_answer(question, answer, ground_truth, model, criteria=criteria)

    if not response:
        return None

    return BinaryEvaluationResult(
        is_correct=response.is_correct,
        reason=response.reason,
        metadata={"evaluator": "correctness", "judge_model": model},
    )
