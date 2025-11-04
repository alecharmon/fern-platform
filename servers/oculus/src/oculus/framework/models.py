from pydantic import BaseModel, Field


class EvaluationResponse(BaseModel):
    is_correct: bool
    reason: str


EVALUATION_PROMPT_TEMPLATE = """You are evaluating the correctness of an AI assistant's answer to a technical question about API documentation.

Question: {question}

Ground Truth / Expected Information:
{ground_truth}

AI Assistant's Answer:
{answer}

Evaluate whether the AI assistant's answer is correct and complete based on the ground truth. The answer should:
1. Accurately represent the information in the ground truth
2. Not include significant hallucinations or incorrect information
3. Address the core question being asked

If the answer is mostly correct with minor issues, mark it as correct. Only mark as incorrect if there are significant errors or omissions.

Provide your evaluation with a brief reason."""


class Question(BaseModel):
    question: str
    ground_truth: str
    metadata: dict[str, str] = Field(default_factory=dict)


class Answer(BaseModel):
    question: str
    answer: str
    model: str
    metadata: dict[str, str] = Field(default_factory=dict)


class Evaluation(BaseModel):
    question: str
    answer: str
    ground_truth: str
    is_correct: bool
    reason: str
    metadata: dict[str, str] = Field(default_factory=dict)


class EvaluationRun(BaseModel):
    run_id: str
    timestamp: str
    suite: str
    results: list[Evaluation]
    metrics: "EvaluationMetrics"


class EvaluationMetrics(BaseModel):
    total_questions: int
    total_correct: int
    accuracy: float
