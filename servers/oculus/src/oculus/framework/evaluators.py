from collections.abc import Callable
from typing import Protocol

from pydantic import BaseModel


class EvaluationResult(BaseModel):
    """Result from an evaluator."""

    is_correct: bool
    reason: str
    metadata: dict[str, str] = {}


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
        self._evaluators: dict[str, Callable[[str, str, str, str], EvaluationResult | None]] = {}

    def register(
        self,
        name: str,
        evaluator_fn: Callable[[str, str, str, str], EvaluationResult | None],
    ) -> None:
        """Register an evaluator function.

        Args:
            name: Name of the evaluator (e.g., 'correctness')
            evaluator_fn: Function that evaluates answers
        """
        self._evaluators[name] = evaluator_fn

    def get(self, name: str) -> Callable[[str, str, str, str], EvaluationResult | None] | None:
        """Get an evaluator by name."""
        return self._evaluators.get(name)

    def list_available(self) -> list[str]:
        """List all available evaluator names."""
        return list(self._evaluators.keys())


# Global registry instance
_registry = EvaluatorRegistry()


def register_evaluator(
    name: str,
) -> Callable[
    [Callable[[str, str, str, str], EvaluationResult | None]], Callable[[str, str, str, str], EvaluationResult | None]
]:
    """Decorator to register an evaluator function.

    Example:
        @register_evaluator("correctness")
        def evaluate_correctness(question: str, answer: str, ground_truth: str, model: str) -> EvaluationResult | None:
            ...
    """

    def decorator(
        fn: Callable[[str, str, str, str], EvaluationResult | None],
    ) -> Callable[[str, str, str, str], EvaluationResult | None]:
        _registry.register(name, fn)
        return fn

    return decorator


def get_evaluator(name: str) -> Callable[[str, str, str, str], EvaluationResult | None] | None:
    """Get an evaluator function by name."""
    return _registry.get(name)


def list_evaluators() -> list[str]:
    """List all registered evaluators."""
    return _registry.list_available()
