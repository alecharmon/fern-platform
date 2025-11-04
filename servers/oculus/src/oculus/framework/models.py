from pydantic import (
    BaseModel,
    Field,
)


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
