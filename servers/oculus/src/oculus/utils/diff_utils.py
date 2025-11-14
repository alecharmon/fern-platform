"""Utilities for generating diffs between evaluation runs."""

from pathlib import Path

from pydantic import BaseModel

from oculus.framework.models import Answer, Evaluation, Question


class DiffMetadata(BaseModel):
    diff_id: str
    timestamp: str
    suite: str
    compared_against: str
    compared_against_file: str
    questions: list[str]
    new_generation: dict[str, str | dict[str, bool]]
    baseline: dict[str, str]
    summary: dict[str, int]


def find_most_recent_run(results_dir: Path) -> str | None:
    if not results_dir.exists():
        return None

    results_files = sorted(results_dir.glob("results_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)

    if not results_files:
        return None

    return results_files[0].stem.replace("results_", "")


def parse_question_ids(question_arg: str, all_question_files: list[Path]) -> list[str]:
    ids = []
    for part in question_arg.split(","):
        part = part.strip()
        if part.isdigit():
            idx = int(part) - 1
            if 0 <= idx < len(all_question_files):
                ids.append(all_question_files[idx].stem)
            else:
                print(f"Warning: Question index {part} out of range (1-{len(all_question_files)})")
        else:
            ids.append(part)

    return ids


def format_correctness_change(baseline_correct: bool, new_correct: bool) -> str:
    if baseline_correct and new_correct:
        return "✅ → ✅ (unchanged)"
    elif not baseline_correct and not new_correct:
        return "❌ → ❌ (unchanged)"
    elif not baseline_correct and new_correct:
        return "❌ → ✅ IMPROVED"
    else:
        return "✅ → ❌ DEGRADED"


def format_response_time_change(baseline_ms: float, new_ms: float) -> str:
    baseline_sec = baseline_ms / 1000
    new_sec = new_ms / 1000
    diff_sec = new_sec - baseline_sec

    if abs(diff_sec) < 0.1:
        return "~"
    elif diff_sec < 0:
        return f"🟢 {diff_sec:.2f}s faster"
    else:
        return f"🔴 +{diff_sec:.2f}s slower"


def extract_retrieved_documents(answer: Answer) -> list[dict[str, str | float]] | None:
    import json

    docs_str = answer.metadata.get("fai_local_retrieved_documents")
    if not docs_str:
        return None

    try:
        docs = json.loads(docs_str)
        return docs if isinstance(docs, list) else None
    except Exception:
        return None


def extract_subqueries(answer: Answer) -> list[str] | None:
    import json

    for key in ["subqueries", "rewritten_queries", "query_decomposition"]:
        subqueries_str = answer.metadata.get(key)
        if subqueries_str:
            try:
                subqueries = json.loads(subqueries_str)
                if isinstance(subqueries, list):
                    return subqueries
            except Exception:
                continue

    return None


def generate_diff_markdown(
    question: Question,
    question_slug: str,
    baseline_answer: Answer,
    baseline_eval: Evaluation,
    new_answer: Answer,
    new_eval: Evaluation,
    baseline_run_id: str,
    diff_id: str,
) -> str:
    baseline_correct = baseline_eval.is_correct
    new_correct = new_eval.is_correct

    baseline_response_time = float(baseline_answer.metadata.get("response_time_ms", 0))
    new_response_time = float(new_answer.metadata.get("response_time_ms", 0))

    baseline_retrieved_docs = extract_retrieved_documents(baseline_answer)
    new_retrieved_docs = extract_retrieved_documents(new_answer)

    baseline_subqueries = extract_subqueries(baseline_answer)
    new_subqueries = extract_subqueries(new_answer)

    correctness_change = format_correctness_change(baseline_correct, new_correct)
    response_time_change = format_response_time_change(baseline_response_time, new_response_time)

    baseline_correctness_result = baseline_eval.evaluator_results.get("correctness")
    new_correctness_result = new_eval.evaluator_results.get("correctness")

    baseline_correctness_reason = baseline_correctness_result.reason if baseline_correctness_result else "N/A"
    new_correctness_reason = new_correctness_result.reason if new_correctness_result else "N/A"

    retrieved_docs_section = ""
    if baseline_retrieved_docs or new_retrieved_docs:
        retrieved_docs_section = "\n---\n\n## Retrieved Documents Comparison\n\n"

        if baseline_retrieved_docs:
            retrieved_docs_section += f"### Baseline ({len(baseline_retrieved_docs)} docs)\n\n"
            for i, doc in enumerate(baseline_retrieved_docs, 1):
                title = doc.get("title", "Unknown")
                score = doc.get("score", 0)
                retrieved_docs_section += f"{i}. **{title}** (score: {score:.4f})\n"

        if new_retrieved_docs:
            retrieved_docs_section += f"\n### New ({len(new_retrieved_docs)} docs)\n\n"
            for i, doc in enumerate(new_retrieved_docs, 1):
                title = doc.get("title", "Unknown")
                score = doc.get("score", 0)
                retrieved_docs_section += f"{i}. **{title}** (score: {score:.4f})\n"

    subqueries_section = ""
    if baseline_subqueries or new_subqueries:
        subqueries_section = "\n---\n\n## Subqueries Comparison\n\n"

        if baseline_subqueries:
            subqueries_section += f"### Baseline ({len(baseline_subqueries)} queries)\n\n"
            for i, sq in enumerate(baseline_subqueries, 1):
                subqueries_section += f"{i}. {sq}\n"

        if new_subqueries:
            subqueries_section += f"\n### New ({len(new_subqueries)} queries)\n\n"
            for i, sq in enumerate(new_subqueries, 1):
                subqueries_section += f"{i}. {sq}\n"

    baseline_pass = "✅ PASS" if baseline_correct else "❌ FAIL"
    new_pass = "✅ PASS" if new_correct else "❌ FAIL"
    model_change = "-" if baseline_answer.model == new_answer.model else "⚠️ Changed"
    baseline_ans_len = len(baseline_answer.answer)
    new_ans_len = len(new_answer.answer)
    ans_len_change = new_ans_len - baseline_ans_len
    baseline_retrieved = len(baseline_retrieved_docs) if baseline_retrieved_docs else 0
    new_retrieved = len(new_retrieved_docs) if new_retrieved_docs else 0
    retrieved_change = new_retrieved - baseline_retrieved
    baseline_subq = len(baseline_subqueries) if baseline_subqueries else 0
    new_subq = len(new_subqueries) if new_subqueries else 0
    subq_change = new_subq - baseline_subq

    md = f"""# Question: {question.question}

**Diff ID:** {diff_id}
**Compared Against:** {baseline_run_id}
**Question Slug:** {question_slug}

---

## Summary

| Metric | Baseline | New | Change |
|--------|----------|-----|--------|
| **Correctness** | {baseline_pass} | {new_pass} | {correctness_change} |
| **Model** | {baseline_answer.model} | {new_answer.model} | {model_change} |
| **Response Time** | {baseline_response_time/1000:.2f}s | {new_response_time/1000:.2f}s | {response_time_change} |
| **Answer Length** | {baseline_ans_len} chars | {new_ans_len} chars | {ans_len_change:+d} chars |
| **Retrieved Docs** | {baseline_retrieved} | {new_retrieved} | {retrieved_change:+d} |
| **Subqueries** | {baseline_subq} | {new_subq} | {subq_change:+d} |

---

# New Answer (Generated: {diff_id})

**Status:** {"✅ CORRECT" if new_correct else "❌ INCORRECT"}

{new_answer.answer}

**Evaluator: Correctness**
> {new_correctness_reason}

---

# Baseline Answer (Run: {baseline_run_id})

**Status:** {"✅ CORRECT" if baseline_correct else "❌ INCORRECT"}

<details>
<summary>View Full Answer</summary>

{baseline_answer.answer}

</details>

**Evaluator: Correctness**
> {baseline_correctness_reason}

---

## Ground Truth

<details>
<summary>View Ground Truth</summary>

{question.ground_truth}

</details>
{retrieved_docs_section}{subqueries_section}
"""

    return md


def calculate_diff_summary(baseline_evals: list[Evaluation], new_evals: list[Evaluation]) -> dict[str, int]:
    correctness_improved = 0
    correctness_degraded = 0
    correctness_unchanged = 0

    baseline_by_q = {e.question: e for e in baseline_evals}
    new_by_q = {e.question: e for e in new_evals}

    for question in baseline_by_q.keys():
        if question not in new_by_q:
            continue

        baseline_correct = baseline_by_q[question].is_correct
        new_correct = new_by_q[question].is_correct

        if baseline_correct == new_correct:
            correctness_unchanged += 1
        elif not baseline_correct and new_correct:
            correctness_improved += 1
        else:
            correctness_degraded += 1

    return {
        "correctness_improved": correctness_improved,
        "correctness_degraded": correctness_degraded,
        "correctness_unchanged": correctness_unchanged,
    }


def generate_diff_markdown_ground_truth(
    question: Question,
    question_slug: str,
    new_answer: Answer,
    new_eval: Evaluation,
    diff_id: str,
) -> str:
    is_correct = new_eval.is_correct
    response_time = float(new_answer.metadata.get("response_time_ms", 0))
    retrieved_docs = extract_retrieved_documents(new_answer)
    subqueries = extract_subqueries(new_answer)

    correctness_result = new_eval.evaluator_results.get("correctness")
    correctness_reason = correctness_result.reason if correctness_result else "N/A"

    retrieved_docs_section = ""
    if retrieved_docs:
        retrieved_docs_section = "\n---\n\n## Retrieved Documents\n\n"
        for i, doc in enumerate(retrieved_docs, 1):
            title = doc.get("title", "Unknown")
            score = doc.get("score", 0)
            slug = doc.get("slug", "")
            url = doc.get("url")

            if url:
                retrieved_docs_section += f"{i}. **[{title}]({url})** (score: {score:.4f})\n"
            else:
                retrieved_docs_section += f"{i}. **{title}** (score: {score:.4f})\n"

            if slug:
                retrieved_docs_section += f"   - Slug: `{slug}`\n"

    subqueries_section = ""
    if subqueries:
        subqueries_section = "\n---\n\n## Subqueries (Query Rewriting)\n\n"
        for i, subquery in enumerate(subqueries, 1):
            subqueries_section += f"{i}. {subquery}\n"

    md = f"""# Question: {question.question}

**Diff ID:** {diff_id}
**Comparison:** Ground Truth
**Question Slug:** {question_slug}

---

## Summary

| Metric | Value |
|--------|-------|
| **Correctness** | {"✅ PASS" if is_correct else "❌ FAIL"} |
| **Model** | {new_answer.model} |
| **Response Time** | {response_time/1000:.2f}s |
| **Answer Length** | {len(new_answer.answer)} chars |
| **Ground Truth Length** | {len(question.ground_truth)} chars |
| **Retrieved Docs** | {len(retrieved_docs) if retrieved_docs else 0} |
| **Subqueries** | {len(subqueries) if subqueries else 0} |

---

## Generated Answer

**Status:** {"✅ CORRECT" if is_correct else "❌ INCORRECT"}

{new_answer.answer}

**Evaluator: Correctness**
> {correctness_reason}

---

## Ground Truth

{question.ground_truth}
{retrieved_docs_section}{subqueries_section}
"""

    return md


def calculate_diff_summary_ground_truth(questions: list[Question], new_evals: list[Evaluation]) -> dict[str, int]:
    return {
        "total_correct": sum(1 for e in new_evals if e.is_correct),
        "total_incorrect": len(new_evals) - sum(1 for e in new_evals if e.is_correct),
        "total_questions": len(new_evals),
    }
