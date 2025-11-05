from pydantic import BaseModel

from oculus.framework.evaluators import (
    EvaluationResult,
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

If the answer is mostly correct with minor issues, mark it as correct. Only mark as incorrect if there are \
significant errors or omissions.

Provide your evaluation with a brief reason."""


def evaluate_answer(
    question: str,
    answer: str,
    ground_truth: str,
    model: str = "claude-opus-4-20250514",
) -> EvaluationResponse | None:
    return generate_with_claude(
        response_type=EvaluationResponse,
        prompt_template=EVALUATION_PROMPT_TEMPLATE,
        model=model,
        question=question,
        answer=answer,
        ground_truth=ground_truth,
    )


@register_evaluator("correctness")
def evaluate_correctness(
    question: str,
    answer: str,
    ground_truth: str,
    model: str = "claude-opus-4-20250514",
) -> EvaluationResult | None:
    response = evaluate_answer(question, answer, ground_truth, model)

    if not response:
        return None

    return EvaluationResult(
        is_correct=response.is_correct,
        reason=response.reason,
        metadata={"evaluator": "correctness", "judge_model": model},
    )
