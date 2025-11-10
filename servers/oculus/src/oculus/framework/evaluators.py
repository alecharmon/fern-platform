from collections.abc import Callable
from typing import Literal, Protocol

from pydantic import BaseModel, Field


class EvaluationResult(BaseModel):
    """Base result from an evaluator."""

    reason: str
    metadata: dict[str, str] = Field(default_factory=dict)
    result_type: str = "base"

    def is_passing(self) -> bool:
        """Check if the evaluation result is passing.

        Subclasses should override this method to define what constitutes a pass.
        """
        raise NotImplementedError("Subclasses must implement is_passing()")


class BinaryEvaluationResult(EvaluationResult):
    """Binary pass/fail evaluation result."""

    result_type: Literal["binary"] = "binary"
    is_correct: bool

    def is_passing(self) -> bool:
        return self.is_correct


class ScaledEvaluationResult(EvaluationResult):
    """Scaled evaluation result (e.g., 1-3 or 1-5 scale)."""

    result_type: Literal["scaled"] = "scaled"
    score: int
    min_score: int
    max_score: int
    passing_threshold: int

    def is_passing(self) -> bool:
        return self.score >= self.passing_threshold


class Evaluator(Protocol):
    """Protocol for answer evaluators."""

    def evaluate(
        self,
        question: str,
        answer: str,
        ground_truth: str,
        model: str,
    ) -> EvaluationResult | None:
        """Evaluate an answer against ground truth.

        Args:
            question: The question that was asked
            answer: The answer to evaluate
            ground_truth: The expected/correct answer
            model: The model to use for evaluation

        Returns:
            EvaluationResult or None if evaluation fails
        """
        ...


class EvaluatorRegistry:
    """Registry for managing answer evaluators."""

    def __init__(self) -> None:
        self._evaluators: dict[str, Callable[..., EvaluationResult | None]] = {}

    def register(
        self,
        name: str,
        evaluator_fn: Callable[..., EvaluationResult | None],
    ) -> None:
        """Register an evaluator function.

        Args:
            name: Name of the evaluator (e.g., 'correctness')
            evaluator_fn: Function that evaluates answers
        """
        self._evaluators[name] = evaluator_fn

    def get(self, name: str) -> Callable[..., EvaluationResult | None] | None:
        """Get an evaluator by name."""
        return self._evaluators.get(name)

    def list_available(self) -> list[str]:
        """List all available evaluator names."""
        return list(self._evaluators.keys())


# Global registry instance
_registry = EvaluatorRegistry()


def register_evaluator(
    name: str,
) -> Callable[[Callable[..., EvaluationResult | None]], Callable[..., EvaluationResult | None]]:
    """Decorator to register an evaluator function.

    Example:
        @register_evaluator("correctness")
        def evaluate_correctness(
            question: str, answer: str, ground_truth: str, model: str, **kwargs
        ) -> EvaluationResult | None:
            ...
    """

    def decorator(
        fn: Callable[..., EvaluationResult | None],
    ) -> Callable[..., EvaluationResult | None]:
        _registry.register(name, fn)
        return fn

    return decorator


def get_evaluator(name: str) -> Callable[..., EvaluationResult | None] | None:
    """Get an evaluator function by name."""
    return _registry.get(name)


def list_evaluators() -> list[str]:
    """List all registered evaluators."""
    return _registry.list_available()
