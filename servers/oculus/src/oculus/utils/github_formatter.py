from datetime import datetime

from oculus.framework.models import EvaluationRun
from oculus.framework.statistics import calculate_category_stats_from_run


def format_github_summary(run: EvaluationRun, full_results_url: str | None = None) -> str:
    """Format evaluation results as GitHub markdown summary."""
    lines = []

    lines.append("## 🔍 Oculus Evaluation Results")
    lines.append("")
    lines.append(
        f"**Suite:** `{run.suite}` | **Run ID:** `{run.run_id}` | " f"**Timestamp:** {_format_timestamp(run.timestamp)}"
    )
    lines.append("")

    lines.append("### Summary")
    accuracy_emoji = "✅" if run.metrics.accuracy >= 0.7 else "⚠️" if run.metrics.accuracy >= 0.5 else "❌"
    lines.append(
        f"- {accuracy_emoji} **Accuracy:** {run.metrics.accuracy:.1%} "
        f"({run.metrics.total_correct}/{run.metrics.total_questions} questions correct)"
    )
    lines.append("")

    category_stats = calculate_category_stats_from_run(run)
    if category_stats:
        lines.append("### Breakdown by Category")
        lines.append("| Category | Correct | Total | Accuracy |")
        lines.append("|----------|---------|-------|----------|")
        for category in sorted(category_stats.keys()):
            stats = category_stats[category]
            acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            lines.append(f"| {category} | {stats['correct']} | {stats['total']} | {acc:.1%} |")
        lines.append("")

    failed_evals = [e for e in run.results if not e.is_correct]
    if failed_evals:
        lines.append("<details>")
        lines.append(f"<summary>📊 View Failed Questions ({len(failed_evals)})</summary>")
        lines.append("")

        for i, evaluation in enumerate(failed_evals[:10], 1):
            lines.append(f"**{i}. {_escape_markdown(evaluation.question)}**")
            lines.append(f"- ❌ **Expected:** {_escape_markdown(_truncate(evaluation.ground_truth, 150))}")
            lines.append(f"- ❌ **Got:** {_escape_markdown(_truncate(evaluation.answer, 150))}")
            lines.append("")

        if len(failed_evals) > 10:
            lines.append(f"*... and {len(failed_evals) - 10} more failed questions*")
            lines.append("")

        lines.append("</details>")
        lines.append("")

    if full_results_url:
        lines.append(f"📎 [View Full Results]({full_results_url})")
    else:
        lines.append("📎 Full results available in workflow artifacts")

    return "\n".join(lines)


def format_github_job_summary(run: EvaluationRun) -> str:
    """Format evaluation results as detailed GitHub job summary."""
    lines = []

    lines.append("# Oculus Evaluation Results")
    lines.append("")
    lines.append(f"**Suite:** {run.suite}")
    lines.append(f"**Run ID:** {run.run_id}")
    lines.append(f"**Timestamp:** {_format_timestamp(run.timestamp)}")
    lines.append("")

    lines.append("## Metrics")
    lines.append(f"- **Total Questions:** {run.metrics.total_questions}")
    lines.append(f"- **Correct Answers:** {run.metrics.total_correct}")
    lines.append(f"- **Accuracy:** {run.metrics.accuracy:.2%}")
    lines.append("")

    if run.metrics.evaluator_pass_rates:
        lines.append("## Evaluator Breakdown")
        lines.append("")
        lines.append("| Evaluator | Pass Rate | Avg Score |")
        lines.append("|-----------|-----------|-----------|")
        for evaluator_name in sorted(run.metrics.evaluator_pass_rates.keys()):
            pass_rate = run.metrics.evaluator_pass_rates[evaluator_name]
            avg_score_str = ""
            if evaluator_name in run.metrics.evaluator_avg_scores:
                avg_score = run.metrics.evaluator_avg_scores[evaluator_name]
                avg_score_str = f"{avg_score:.2f}"
            lines.append(f"| {evaluator_name} | {pass_rate:.1%} | {avg_score_str} |")
        lines.append("")

    category_stats = calculate_category_stats_from_run(run)
    if category_stats:
        lines.append("## Category Breakdown")
        lines.append("")
        lines.append("| Category | Correct | Total | Accuracy |")
        lines.append("|----------|---------|-------|----------|")
        for category in sorted(category_stats.keys()):
            stats = category_stats[category]
            acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            lines.append(f"| {category} | {stats['correct']} | {stats['total']} | {acc:.2%} |")
        lines.append("")

    passed_evals = [e for e in run.results if e.is_correct]
    failed_evals = [e for e in run.results if not e.is_correct]

    if passed_evals:
        lines.append("<details>")
        lines.append(f"<summary>✅ Passed Questions ({len(passed_evals)})</summary>")
        lines.append("")
        for i, evaluation in enumerate(passed_evals, 1):
            lines.append(f"{i}. {_escape_markdown(evaluation.question)}")
        lines.append("")
        lines.append("</details>")
        lines.append("")

    if failed_evals:
        lines.append("<details open>")
        lines.append(f"<summary>❌ Failed Questions ({len(failed_evals)})</summary>")
        lines.append("")

        for i, evaluation in enumerate(failed_evals, 1):
            lines.append(f"### {i}. {_escape_markdown(evaluation.question)}")
            lines.append("")
            lines.append("**Ground Truth:**")
            lines.append(f"> {_escape_markdown(evaluation.ground_truth)}")
            lines.append("")
            lines.append("**Model Answer:**")
            lines.append(f"> {_escape_markdown(evaluation.answer)}")
            lines.append("")

            if evaluation.evaluator_results:
                lines.append("**Evaluator Results:**")
                for eval_name, eval_result in evaluation.evaluator_results.items():
                    from oculus.framework.models import ScaledEvaluatorResult

                    status = "✅" if eval_result.is_passing else "❌"
                    score_info = ""
                    if isinstance(eval_result, ScaledEvaluatorResult):
                        score_info = f" ({eval_result.score}/{eval_result.max_score})"
                    lines.append(f"- {status} **{eval_name}**{score_info}: {_escape_markdown(eval_result.reason)}")
                lines.append("")

            metadata = evaluation.metadata
            if metadata.get("slug"):
                lines.append(f"**Slug:** `{metadata['slug']}`")
            if metadata.get("category"):
                lines.append(f"**Category:** `{metadata['category']}`")
            lines.append("")
            lines.append("---")
            lines.append("")

        lines.append("</details>")
        lines.append("")

    return "\n".join(lines)


def _format_timestamp(timestamp_str: str) -> str:
    """Format ISO timestamp to readable format."""
    try:
        dt = datetime.fromisoformat(timestamp_str)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return timestamp_str


def _truncate(text: str, max_length: int) -> str:
    """Truncate text to max length with ellipsis."""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."


def _escape_markdown(text: str) -> str:
    """Escape markdown special characters to prevent formatting issues."""
    special_chars = ["\\", "`", "*", "_", "{", "}", "[", "]", "(", ")", "#", "+", "-", ".", "!", "|"]
    escaped = text
    for char in special_chars:
        escaped = escaped.replace(char, "\\" + char)
    return escaped
