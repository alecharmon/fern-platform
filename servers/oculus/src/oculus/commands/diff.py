"""Diff command implementation for comparing evaluation runs."""

import argparse
import sys
from datetime import datetime
from pathlib import Path

from oculus.framework.models import Answer, Evaluation, EvaluationRun, Question, SuiteConfig
from oculus.framework.runner import EvaluationRunner
from oculus.integrations.base import create_answer_function
from oculus.integrations.factory import create_integration
from oculus.utils.diff_utils import (
    DiffMetadata,
    calculate_diff_summary,
    calculate_diff_summary_ground_truth,
    find_most_recent_run,
    generate_diff_markdown,
    generate_diff_markdown_ground_truth,
    parse_question_ids,
)
from oculus.utils.file_utils import load_json, save_json


def diff_evaluation_command(args: argparse.Namespace) -> int:
    suite_base = args.suite_path if args.suite_path else Path.cwd() / "suites"
    suite_path = suite_base / args.suite

    if not suite_path.exists():
        print(f"Error: Suite directory not found: {suite_path}", file=sys.stderr)
        return 1

    config_path = suite_path / "config.json"
    if not config_path.exists():
        print(f"Error: Suite config not found: {config_path}", file=sys.stderr)
        return 1

    try:
        config_data = load_json(config_path)
        suite_config = SuiteConfig(**config_data)
    except Exception as e:
        print(f"Error: Failed to load suite config: {e}", file=sys.stderr)
        return 1

    questions_dir = suite_path / "questions"
    if not questions_dir.exists() or not any(questions_dir.glob("*.json")):
        print(f"Error: No questions found in {questions_dir}", file=sys.stderr)
        return 1

    try:
        all_question_files = sorted(questions_dir.glob("*.json"), key=lambda f: f.stem)

        if args.questions:
            question_ids = parse_question_ids(args.questions, all_question_files)
            question_files = [f for f in all_question_files if f.stem in question_ids]
        else:
            question_files = all_question_files
            question_ids = [f.stem for f in all_question_files]

        questions = [Question(**load_json(f)) for f in question_files]

        results_dir = Path.cwd() / "results" / args.suite

        baseline_run_id: str | None = None
        baseline_run: EvaluationRun | None = None
        baseline_answers: dict[str, Answer] = {}
        baseline_evals_by_q: dict[str, Evaluation] = {}
        use_baseline = args.baseline

        if use_baseline:
            baseline_run_id, baseline_run, baseline_answers, baseline_evals_by_q = _load_baseline_data(
                args, results_dir
            )
            if baseline_run_id is None:
                return 1
        else:
            print("Comparison mode: GROUND TRUTH")

        integration_type = _get_integration_type(args, suite_config)
        rewrite_query = (
            getattr(suite_config, "rewrite_query", False) if integration_type in ["fai-local", "fai-http"] else False
        )

        print(f"Initializing {integration_type} integration for domain: {suite_config.domain}")
        if rewrite_query:
            print("Query rewriting: ENABLED")

        integration = create_integration(
            integration_type=integration_type, domain=suite_config.domain, model=args.model, rewrite_query=rewrite_query
        )
        answer_fn = create_answer_function(integration)

        diff_id = args.diff_id or datetime.now().strftime("%Y%m%d_%H%M%S")

        _print_diff_header(args, suite_config, diff_id, len(questions))

        print("Generating fresh answers...")
        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            domain=suite_config.domain,
            generators=suite_config.generators,
            evaluators=suite_config.evaluators,
            run_id=diff_id,
            max_workers=args.max_workers,
            num_questions_generation=suite_config.num_questions_generation,
            generator_config=suite_config.generator_config,
        )

        new_answers = runner.generate_answers(
            questions=questions,
            answer_fn=answer_fn,
            model_name=args.model,
            skip_existing=False,
        )

        print("\nEvaluating fresh answers...")
        new_evaluations = runner.evaluate_answers(
            questions=questions,
            answers=new_answers,
            judge_model=args.judge_model,
            skip_existing=False,
        )

        new_evals_by_q = {e.question: e for e in new_evaluations}

        diffs_dir = results_dir / "diffs" / diff_id
        diffs_dir.mkdir(parents=True, exist_ok=True)

        print("\nGenerating diff markdowns...")

        if use_baseline and baseline_run_id:
            _generate_baseline_diffs(
                questions,
                question_ids,
                baseline_answers,
                baseline_evals_by_q,
                new_answers,
                new_evals_by_q,
                baseline_run_id,
                diff_id,
                diffs_dir,
            )
        else:
            _generate_ground_truth_diffs(questions, question_ids, new_answers, new_evals_by_q, diff_id, diffs_dir)

        if use_baseline:
            summary = calculate_diff_summary(
                baseline_evals=[
                    baseline_evals_by_q[q.question] for q in questions if q.question in baseline_evals_by_q
                ],
                new_evals=[new_evals_by_q[q.question] for q in questions if q.question in new_evals_by_q],
            )
        else:
            summary = calculate_diff_summary_ground_truth(
                questions=questions,
                new_evals=[new_evals_by_q[q.question] for q in questions if q.question in new_evals_by_q],
            )

        metadata = _create_metadata(
            diff_id,
            args,
            suite_config,
            question_ids,
            baseline_run_id,
            baseline_run,
            use_baseline,
            args.model,
            integration_type,
            rewrite_query,
            summary,
        )

        metadata_path = diffs_dir / "metadata.json"
        save_json(metadata_path, metadata.model_dump())

        _print_diff_summary(diff_id, baseline_run_id, use_baseline, question_ids, summary, diffs_dir)

        return 0

    except ImportError as e:
        print("\nError: Failed to import required modules", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        print("\nMake sure:", file=sys.stderr)
        print("  1. FAI dependencies are installed (poetry install in servers/fai)", file=sys.stderr)
        print("  2. PYTHONPATH includes the FAI source directory", file=sys.stderr)
        return 1

    except Exception as e:
        print("\nError: Diff generation failed", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


def _load_baseline_data(
    args: argparse.Namespace, results_dir: Path
) -> tuple[str | None, EvaluationRun | None, dict[str, Answer], dict[str, Evaluation]]:
    if args.baseline_run:
        baseline_run_id = args.baseline_run
    else:
        baseline_run_id = find_most_recent_run(results_dir)

    if not baseline_run_id:
        print("Error: No baseline run found. Run 'oculus run' first to create a baseline.", file=sys.stderr)
        return None, None, {}, {}

    print("Comparison mode: BASELINE")
    print(f"Baseline run: {baseline_run_id}")

    baseline_results_file = results_dir / f"results_{baseline_run_id}.json"
    if not baseline_results_file.exists():
        print(f"Error: Baseline results file not found: {baseline_results_file}", file=sys.stderr)
        return None, None, {}, {}

    baseline_run = EvaluationRun(**load_json(baseline_results_file))
    baseline_answers_dir = results_dir / "answers" / baseline_run_id

    baseline_evals_by_q = {e.question: e for e in baseline_run.results}

    baseline_answers = {}
    if baseline_answers_dir.exists():
        for ans_file in baseline_answers_dir.glob("*.json"):
            ans = Answer(**load_json(ans_file))
            baseline_answers[ans.question] = ans

    return baseline_run_id, baseline_run, baseline_answers, baseline_evals_by_q


def _get_integration_type(args: argparse.Namespace, suite_config: SuiteConfig) -> str:
    if hasattr(args, "integration") and args.integration:
        return str(args.integration)
    else:
        return suite_config.integration


def _print_diff_header(args: argparse.Namespace, suite_config: SuiteConfig, diff_id: str, num_questions: int) -> None:
    """Print diff command header.

    Args:
        args: Command line arguments
        suite_config: Suite configuration
        diff_id: Diff run ID
        num_questions: Number of questions
    """
    print(f"\n{'='*60}")
    print(f"Starting diff: {diff_id}")
    print(f"Suite: {args.suite}")
    print(f"Domain: {suite_config.domain}")
    print(f"Model: {args.model}")
    print(f"Questions: {num_questions}")
    print(f"{'='*60}\n")


def _generate_baseline_diffs(
    questions: list[Question],
    question_ids: list[str],
    baseline_answers: dict[str, Answer],
    baseline_evals_by_q: dict[str, Evaluation],
    new_answers: list[Answer],
    new_evals_by_q: dict[str, Evaluation],
    baseline_run_id: str,
    diff_id: str,
    diffs_dir: Path,
) -> None:
    for i, question in enumerate(questions, 1):
        q_text = question.question

        baseline_eval = baseline_evals_by_q.get(q_text)
        baseline_answer = baseline_answers.get(q_text)
        new_eval = new_evals_by_q.get(q_text)
        new_answer = new_answers[i - 1] if i <= len(new_answers) else None

        if not baseline_eval or not baseline_answer:
            print(f"  Skipping {question_ids[i-1]}: not found in baseline")
            continue

        if not new_eval or not new_answer:
            print(f"  Skipping {question_ids[i-1]}: generation failed")
            continue

        diff_md = generate_diff_markdown(
            question=question,
            question_slug=question_ids[i - 1],
            baseline_answer=baseline_answer,
            baseline_eval=baseline_eval,
            new_answer=new_answer,
            new_eval=new_eval,
            baseline_run_id=baseline_run_id,
            diff_id=diff_id,
        )

        md_path = diffs_dir / f"{question_ids[i-1]}.md"
        md_path.write_text(diff_md)
        print(f"  Generated: {question_ids[i-1]}.md")


def _generate_ground_truth_diffs(
    questions: list[Question],
    question_ids: list[str],
    new_answers: list[Answer],
    new_evals_by_q: dict[str, Evaluation],
    diff_id: str,
    diffs_dir: Path,
) -> None:
    for i, question in enumerate(questions, 1):
        new_eval = new_evals_by_q.get(question.question)
        new_answer = new_answers[i - 1] if i <= len(new_answers) else None

        if not new_eval or not new_answer:
            print(f"  Skipping {question_ids[i-1]}: generation failed")
            continue

        diff_md = generate_diff_markdown_ground_truth(
            question=question,
            question_slug=question_ids[i - 1],
            new_answer=new_answer,
            new_eval=new_eval,
            diff_id=diff_id,
        )

        md_path = diffs_dir / f"{question_ids[i-1]}.md"
        md_path.write_text(diff_md)
        print(f"  Generated: {question_ids[i-1]}.md")


def _create_metadata(
    diff_id: str,
    args: argparse.Namespace,
    suite_config: SuiteConfig,
    question_ids: list[str],
    baseline_run_id: str | None,
    baseline_run: EvaluationRun | None,
    use_baseline: bool,
    model: str,
    integration_type: str,
    rewrite_query: bool,
    summary: dict[str, int],
) -> DiffMetadata:
    return DiffMetadata(
        diff_id=diff_id,
        timestamp=datetime.now().isoformat(),
        suite=args.suite,
        compared_against=baseline_run_id if (use_baseline and baseline_run_id) else "ground_truth",
        compared_against_file=(
            f"results_{baseline_run_id}.json" if (use_baseline and baseline_run_id) else "ground_truth"
        ),
        questions=question_ids,
        new_generation={
            "model": model,
            "integration": integration_type,
            "config": {"rewrite_query": rewrite_query} if integration_type in ["fai-local", "fai-http"] else {},
        },
        baseline={
            "model": str(
                baseline_run.results[0].metadata.get("model")
                if (baseline_run and baseline_run.results)
                else "ground_truth"
            ),
            "integration": str(
                baseline_run.results[0].metadata.get("integration_type")
                if (baseline_run and baseline_run.results)
                else "ground_truth"
            ),
        },
        summary=summary,
    )


def _print_diff_summary(
    diff_id: str,
    baseline_run_id: str | None,
    use_baseline: bool,
    question_ids: list[str],
    summary: dict[str, int],
    diffs_dir: Path,
) -> None:
    print(f"\n{'='*60}")
    print("DIFF SUMMARY")
    print(f"{'='*60}")
    print(f"Diff ID: {diff_id}")
    print(f"Comparison: {'BASELINE (' + (baseline_run_id or '') + ')' if use_baseline else 'GROUND TRUTH'}")
    print(f"Questions: {len(question_ids)}")

    if use_baseline:
        print(f"Correctness Improved: {summary['correctness_improved']}")
        print(f"Correctness Degraded: {summary['correctness_degraded']}")
        print(f"Correctness Unchanged: {summary['correctness_unchanged']}")
    else:
        print(f"Total Correct: {summary['total_correct']}")
        print(f"Total Incorrect: {summary['total_incorrect']}")
        print(f"Accuracy: {summary['total_correct'] / summary['total_questions']:.1%}")

    print(f"\nDiffs saved to: {diffs_dir}")
    print(f"{'='*60}\n")
