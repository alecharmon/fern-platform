from typing import Any

from pydantic import BaseModel

from oculus.framework.evaluators import (
    ScaledEvaluationResult,
    register_evaluator,
)
from oculus.utils.anthropic_utils import generate_with_claude


class ConcisenessEvaluationResponse(BaseModel):
    conciseness_score: int
    reasoning: str


CONCISENESS_EVALUATION_PROMPT_TEMPLATE = """You are evaluating whether the AI assistant's answer is appropriately \
concise and relevant.

Question: {question}

AI Assistant's Answer:
{answer}

Rate on a scale of 1-5:
5 - Perfect balance: directly answers question, no filler, complete
4 - Good: mostly on-topic, minor verbosity or tangents
3 - Acceptable: answers question but with notable irrelevant content or excessive length
2 - Poor: significantly verbose or includes confusing irrelevant details
1 - Very poor: mostly irrelevant or so verbose it's hard to extract the answer
{criteria_section}
Provide:
- conciseness_score (1-5)
- reasoning (1-2 sentences)"""


def evaluate_answer_conciseness(
    question: str,
    answer: str,
    model: str = "claude-sonnet-4-5-20250929",
    criteria: list[str] | None = None,
) -> ConcisenessEvaluationResponse | None:
    if criteria and len(criteria) > 0:
        criteria_text = "\n".join(f"- {c}" for c in criteria)
        criteria_section = (
            f"\n\nIMPORTANT: The answer must also meet ALL of the following required criteria to score "
            f"well:\n{criteria_text}\n"
        )
    else:
        criteria_section = ""

    return generate_with_claude(
        response_type=ConcisenessEvaluationResponse,
        prompt_template=CONCISENESS_EVALUATION_PROMPT_TEMPLATE,
        model=model,
        question=question,
        answer=answer,
        criteria_section=criteria_section,
    )


@register_evaluator("conciseness")
def evaluate_conciseness(
    question: str,
    answer: str,
    ground_truth: str,
    model: str = "claude-sonnet-4-5-20250929",
    **kwargs: Any,
) -> ScaledEvaluationResult | None:
    criteria = kwargs.get("criteria")
    response = evaluate_answer_conciseness(question, answer, model, criteria=criteria)

    if not response:
        return None

    return ScaledEvaluationResult(
        score=response.conciseness_score,
        min_score=1,
        max_score=5,
        passing_threshold=3,
        reason=response.reasoning,
        metadata={"evaluator": "conciseness", "judge_model": model},
    )
