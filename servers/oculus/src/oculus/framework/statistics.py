from collections import defaultdict

from oculus.framework.models import (
    Evaluation,
    EvaluationMetrics,
    EvaluationRun,
    ScaledEvaluatorResult,
)


def calculate_metrics(evaluations: list[Evaluation]) -> EvaluationMetrics:
    total_questions = len(evaluations)
    total_correct = sum(1 for e in evaluations if e.is_correct)
    accuracy = total_correct / total_questions if total_questions > 0 else 0.0

    evaluator_pass_rates: dict[str, float] = {}
    evaluator_avg_scores: dict[str, float] = {}

    evaluator_names: set[str] = set()
    for evaluation in evaluations:
        evaluator_names.update(evaluation.evaluator_results.keys())

    for evaluator_name in evaluator_names:
        results_for_evaluator = [
            e.evaluator_results[evaluator_name] for e in evaluations if evaluator_name in e.evaluator_results
        ]
        if results_for_evaluator:
            passing_count = sum(1 for r in results_for_evaluator if r.is_passing)
            evaluator_pass_rates[evaluator_name] = passing_count / len(results_for_evaluator)

            scaled_results = [r for r in results_for_evaluator if isinstance(r, ScaledEvaluatorResult)]
            if scaled_results:
                avg_score = sum(r.score for r in scaled_results) / len(scaled_results)
                evaluator_avg_scores[evaluator_name] = avg_score

    return EvaluationMetrics(
        total_questions=total_questions,
        total_correct=total_correct,
        accuracy=accuracy,
        evaluator_pass_rates=evaluator_pass_rates,
        evaluator_avg_scores=evaluator_avg_scores,
    )


def calculate_metrics_from_run(run: EvaluationRun) -> EvaluationMetrics:
    return calculate_metrics(run.results)


def calculate_category_stats(evaluations: list[Evaluation]) -> dict[str, dict[str, int]]:
    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})

    for evaluation in evaluations:
        category = evaluation.metadata.get("category", "unknown")
        stats[category]["total"] += 1
        if evaluation.is_correct:
            stats[category]["correct"] += 1

    return dict(stats)


def calculate_category_stats_from_run(run: EvaluationRun) -> dict[str, dict[str, int]]:
    return calculate_category_stats(run.results)
