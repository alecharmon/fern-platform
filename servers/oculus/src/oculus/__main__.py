import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

import oculus.evaluators.citation  # noqa: F401
import oculus.evaluators.correctness  # noqa: F401
import oculus.evaluators.length  # noqa: F401
import oculus.evaluators.style  # noqa: F401
import oculus.generators.endpoints  # noqa: F401
import oculus.generators.markdown  # noqa: F401
from oculus.commands.diff import diff_evaluation_command
from oculus.framework.models import (
    Answer,
    EvaluationRun,
    SuiteConfig,
)
from oculus.framework.runner import EvaluationRunner
from oculus.integrations.base import create_answer_function
from oculus.integrations.factory import create_integration
from oculus.utils.file_utils import (
    load_json,
    save_json,
)
from oculus.utils.github_formatter import (
    format_github_job_summary,
    format_github_summary,
)

load_dotenv()


def generate_answers_command(args: argparse.Namespace) -> int:
    """Generate answers for a suite."""
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

    try:
        if hasattr(args, "integration") and args.integration:
            integration_type = args.integration
        else:
            integration_type = suite_config.integration

        rewrite_query = suite_config.rewrite_query if integration_type in ["fai-local", "fai-http"] else False

        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            collections=suite_config.collections,
            evaluators=suite_config.evaluators,
            run_id=args.run_id,
            max_workers=args.max_workers,
        )

        domains = runner.get_domains()

        print(f"\n{'='*60}")
        print(f"Generating answers: {runner.run_id}")
        print(f"Suite: {args.suite}")
        print(f"Domains: {', '.join(sorted(domains))}")
        print(f"Model: {args.model}")
        print(f"{'='*60}\n")

        print("Loading questions...")
        all_questions = runner.load_questions()

        if args.questions:
            question_slugs = [q.metadata.get("slug", f"question_{i}") for i, q in enumerate(all_questions)]
            question_ids = []
            for part in args.questions.split(","):
                part = part.strip()
                if part.isdigit():
                    idx = int(part) - 1
                    if 0 <= idx < len(question_slugs):
                        question_ids.append(question_slugs[idx])
                    else:
                        print(f"Warning: Question index {part} out of range (1-{len(question_slugs)})")
                else:
                    question_ids.append(part)

            questions = [q for q in all_questions if q.metadata.get("slug") in question_ids]
            print(f"Filtered to {len(questions)} questions (from {len(all_questions)} total)\n")
        else:
            questions = all_questions
            print(f"Total questions: {len(questions)}\n")

        from collections import defaultdict
        questions_by_domain = defaultdict(list)
        for question in questions:
            domain = question.metadata.get("domain")
            if not domain:
                raise ValueError(f"Question missing domain in metadata: {question.question[:50]}...")
            questions_by_domain[domain].append(question)

        print("Generating answers...")
        for domain in sorted(questions_by_domain.keys()):
            domain_questions = questions_by_domain[domain]
            print(f"\nDomain: {domain} ({len(domain_questions)} questions)")

            if suite_config.rewrite_query and integration_type not in ["fai-local", "fai-http"]:
                print(
                    f"Warning: Query rewriting not available for {integration_type} integration "
                    f"(only supported for fai-local and fai-http)"
                )
            if rewrite_query:
                print("Query rewriting: ENABLED")

            integration = create_integration(
                integration_type=integration_type, domain=domain, model=args.model, rewrite_query=rewrite_query
            )
            answer_fn = create_answer_function(integration)

            runner.generate_answers(
                questions=domain_questions,
                answer_fn=answer_fn,
                model_name=args.model,
                skip_existing=not args.no_skip_existing,
            )

        print(f"\n{'='*60}")
        print(f"Answers saved to {runner.answers_dir}")
        print(f"Run ID: {runner.run_id}")
        print(f"{'='*60}\n")

        return 0

    except ImportError as e:
        print("\nError: Failed to import required modules", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        print("\nMake sure:", file=sys.stderr)
        print("  1. FAI dependencies are installed (poetry install in servers/fai)", file=sys.stderr)
        print("  2. PYTHONPATH includes the FAI source directory", file=sys.stderr)
        return 1

    except Exception as e:
        print("\nError: Answer generation failed", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


def evaluate_answers_command(args: argparse.Namespace) -> int:
    """Evaluate existing answers for a suite."""
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

    try:
        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            collections=suite_config.collections,
            evaluators=suite_config.evaluators,
            run_id=args.run_id,
            max_workers=args.max_workers,
        )

        domains = runner.get_domains()

        if not runner.answers_dir.exists() or not any(runner.answers_dir.glob("*.json")):
            print(f"Error: No answers found in {runner.answers_dir}", file=sys.stderr)
            print(f"Hint: Run 'oculus answer --suite {args.suite} --run-id {args.run_id}' first", file=sys.stderr)
            return 1

        print(f"\n{'='*60}")
        print(f"Evaluating answers: {runner.run_id}")
        print(f"Suite: {args.suite}")
        print(f"Domains: {', '.join(sorted(domains))}")
        print(f"Evaluators: {suite_config.evaluators}")
        print(f"{'='*60}\n")

        print("Loading questions...")
        all_questions = runner.load_questions()

        if args.questions:
            question_slugs = [q.metadata.get("slug", f"question_{i}") for i, q in enumerate(all_questions)]
            question_ids = []
            for part in args.questions.split(","):
                part = part.strip()
                if part.isdigit():
                    idx = int(part) - 1
                    if 0 <= idx < len(question_slugs):
                        question_ids.append(question_slugs[idx])
                    else:
                        print(f"Warning: Question index {part} out of range (1-{len(question_slugs)})")
                else:
                    question_ids.append(part)

            question_ids_set = set(question_ids)
            questions = [q for q in all_questions if q.metadata.get("slug") in question_ids_set]
            print(f"Filtered to {len(questions)} questions (from {len(all_questions)} total)\n")
        else:
            questions = all_questions
            question_ids_set = {q.metadata.get("slug", f"question_{i}") for i, q in enumerate(all_questions)}
            print(f"Total questions: {len(questions)}\n")

        print("Loading answers...")
        all_answer_files = sorted(runner.answers_dir.glob("*.json"), key=lambda f: f.stem)
        answer_files = [f for f in all_answer_files if f.stem in question_ids_set]
        answers = [Answer(**load_json(f)) for f in answer_files]
        print(f"Total answers: {len(answers)}\n")

        print("Evaluating answers...")
        evaluations = runner.evaluate_answers(
            questions=questions,
            answers=answers,
            judge_model=args.judge_model,
            skip_existing=not args.no_skip_existing,
        )
        print()

        print("Calculating metrics...")
        metrics = runner.calculate_metrics(evaluations)

        run_result = EvaluationRun(
            run_id=runner.run_id,
            timestamp=datetime.now().isoformat(),
            suite=args.suite,
            results=evaluations,
            metrics=metrics,
        )

        results_path = runner.results_dir / f"results_{runner.run_id}.json"
        save_json(results_path, run_result.model_dump())
        print(f"Saved results to {results_path}\n")

        if args.output_dir:
            args.output_dir.mkdir(parents=True, exist_ok=True)
            output_path = args.output_dir / f"results_{runner.run_id}.json"
            save_json(output_path, run_result.model_dump())
            print(f"Additional output saved to: {output_path}\n")

        _write_github_outputs(args, run_result)

        print(f"{'='*60}")
        print("EVALUATION SUMMARY")
        print(f"{'='*60}")
        print(f"Suite: {args.suite}")
        print(f"Run ID: {runner.run_id}")
        print(f"Total Questions: {metrics.total_questions}")
        print(f"Total Correct: {metrics.total_correct}")
        print(f"Accuracy: {metrics.accuracy:.2%}")
        if metrics.evaluator_pass_rates:
            print("\nEvaluator Pass Rates:")
            for evaluator, rate in sorted(metrics.evaluator_pass_rates.items()):
                print(f"  {evaluator}: {rate:.2%}")
        if metrics.evaluator_avg_scores:
            print("\nEvaluator Average Scores:")
            for evaluator, score in sorted(metrics.evaluator_avg_scores.items()):
                print(f"  {evaluator}: {score:.2f}")
        if metrics.evaluator_avg_values:
            print("\nEvaluator Statistics:")
            for evaluator in sorted(metrics.evaluator_avg_values.keys()):
                avg = metrics.evaluator_avg_values[evaluator]
                std = metrics.evaluator_std_values.get(evaluator, 0.0)
                print(f"  {evaluator}: avg={avg:.2f}, std={std:.2f}")
        print(f"{'='*60}\n")

        return 0

    except Exception as e:
        print("\nError: Evaluation failed", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


def run_evaluation(args: argparse.Namespace) -> int:
    """Run evaluation on a suite."""
    suite_base = args.suite_path if args.suite_path else Path.cwd() / "suites"
    suite_path = suite_base / args.suite

    if not suite_path.exists():
        print(f"Error: Suite directory not found: {suite_path}", file=sys.stderr)
        print("\nExpected structure:", file=sys.stderr)
        print(f"  {suite_path}/", file=sys.stderr)
        print("    config.json", file=sys.stderr)
        print("    questions/", file=sys.stderr)
        print("      question_0.json", file=sys.stderr)
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


    try:
        if hasattr(args, "integration") and args.integration:
            integration_type = args.integration
        else:
            integration_type = suite_config.integration

        rewrite_query = suite_config.rewrite_query if integration_type in ["fai-local", "fai-http"] else False

        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            collections=suite_config.collections,
            evaluators=suite_config.evaluators,
            run_id=args.run_id,
            max_workers=args.max_workers,
        )

        domains = runner.get_domains()

        print(f"\n{'='*60}")
        print(f"Starting evaluation run: {runner.run_id}")
        print(f"Suite: {args.suite}")
        print(f"Domains: {', '.join(sorted(domains))}")
        print(f"{'='*60}\n")

        print("Stage 1: Loading questions...")
        all_questions = runner.load_questions()

        if args.questions:
            question_slugs = [q.metadata.get("slug", f"question_{i}") for i, q in enumerate(all_questions)]
            question_ids = []
            for part in args.questions.split(","):
                part = part.strip()
                if part.isdigit():
                    idx = int(part) - 1
                    if 0 <= idx < len(question_slugs):
                        question_ids.append(question_slugs[idx])
                    else:
                        print(f"Warning: Question index {part} out of range (1-{len(question_slugs)})")
                else:
                    question_ids.append(part)

            questions = [q for q in all_questions if q.metadata.get("slug") in question_ids]
            print(f"Using {len(questions)} filtered questions (from {len(all_questions)} total)\n")
        else:
            questions = all_questions
            print(f"Total questions: {len(questions)}\n")

        from collections import defaultdict
        questions_by_domain = defaultdict(list)
        for question in questions:
            domain = question.metadata.get("domain")
            if not domain:
                raise ValueError(f"Question missing domain in metadata: {question.question[:50]}...")
            questions_by_domain[domain].append(question)

        print("Stage 2: Generating answers...")
        all_answers = []
        for domain in sorted(questions_by_domain.keys()):
            domain_questions = questions_by_domain[domain]
            print(f"\nDomain: {domain} ({len(domain_questions)} questions)")

            if suite_config.rewrite_query and integration_type not in ["fai-local", "fai-http"]:
                print(
                    f"Warning: Query rewriting not available for {integration_type} integration "
                    f"(only supported for fai-local and fai-http)"
                )
            if rewrite_query:
                print("Query rewriting: ENABLED")

            integration = create_integration(
                integration_type=integration_type, domain=domain, model=args.model, rewrite_query=rewrite_query
            )
            answer_fn = create_answer_function(integration)

            answers = runner.generate_answers(
                questions=domain_questions,
                answer_fn=answer_fn,
                model_name=args.model,
                skip_existing=not args.no_skip_existing,
            )
            all_answers.extend(answers)

        print()
        print("Stage 3: Evaluating answers...")
        evaluations = runner.evaluate_answers(
            questions=questions,
            answers=all_answers,
            judge_model=args.judge_model,
            skip_existing=not args.no_skip_existing,
        )
        print()

        print("Stage 4: Calculating metrics...")
        metrics = runner.calculate_metrics(evaluations)

        result = EvaluationRun(
            run_id=runner.run_id,
            timestamp=datetime.now().isoformat(),
            suite=runner.suite_name,
            results=evaluations,
            metrics=metrics,
        )

        results_path = runner.results_dir / f"results_{runner.run_id}.json"
        save_json(results_path, runner._serialize_evaluation_run(result))
        print(f"Saved results to {results_path}\n")

        print(f"{'='*60}")
        print("EVALUATION SUMMARY")
        print(f"{'='*60}")
        print(f"Suite: {runner.suite_name}")
        print(f"Run ID: {runner.run_id}")
        print(f"Total Questions: {metrics.total_questions}")
        print(f"Total Correct: {metrics.total_correct}")
        print(f"Accuracy: {metrics.accuracy:.2%}")
        if metrics.evaluator_pass_rates:
            print("\nEvaluator Pass Rates:")
            for evaluator, rate in sorted(metrics.evaluator_pass_rates.items()):
                print(f"  {evaluator}: {rate:.2%}")
        if metrics.evaluator_avg_scores:
            print("\nEvaluator Average Scores:")
            for evaluator, score in sorted(metrics.evaluator_avg_scores.items()):
                print(f"  {evaluator}: {score:.2f}")
        if metrics.evaluator_avg_values:
            print("\nEvaluator Statistics:")
            for evaluator in sorted(metrics.evaluator_avg_values.keys()):
                avg = metrics.evaluator_avg_values[evaluator]
                std = metrics.evaluator_std_values.get(evaluator, 0.0)
                print(f"  {evaluator}: avg={avg:.2f}, std={std:.2f}")

        if len(suite_config.collections) > 1:
            print(f"\n{'-'*60}")
            print("PER-COLLECTION RESULTS")
            print(f"{'-'*60}")
            metrics_by_collection = runner.calculate_metrics_by_collection(evaluations)
            for collection in suite_config.collections:
                if collection in metrics_by_collection:
                    coll_metrics = metrics_by_collection[collection]
                    print(f"\n{collection}:")
                    print(f"  Questions: {coll_metrics.total_questions}")
                    print(f"  Correct: {coll_metrics.total_correct}")
                    print(f"  Accuracy: {coll_metrics.accuracy:.2%}")

        print(f"{'='*60}\n")

        if args.output_dir:
            args.output_dir.mkdir(parents=True, exist_ok=True)
            output_path = args.output_dir / f"results_{result.run_id}.json"
            save_json(output_path, result.model_dump())
            print(f"\nAdditional output saved to: {output_path}")

        _write_github_outputs(args, result)

        return 0

    except ImportError as e:
        print("\nError: Failed to import required modules", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        print("\nMake sure:", file=sys.stderr)
        print("  1. FAI dependencies are installed (poetry install in servers/fai)", file=sys.stderr)
        print("  2. PYTHONPATH includes the FAI source directory", file=sys.stderr)
        return 1

    except Exception as e:
        print("\nError: Evaluation failed", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


def _write_github_outputs(args: argparse.Namespace, run_result: EvaluationRun) -> None:
    """Write GitHub-formatted outputs if requested."""
    if not hasattr(args, "github_output") or not args.github_output:
        return

    if not args.output_dir:
        print("Warning: --github-output requires --output-dir, skipping GitHub outputs")
        return

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    summary_path = output_dir / f"github_summary_{run_result.run_id}.md"
    summary_content = format_github_summary(run_result, full_results_url=None)
    summary_path.write_text(summary_content)
    print(f"GitHub summary written to: {summary_path}")

    job_summary_path = output_dir / f"github_job_summary_{run_result.run_id}.md"
    job_summary_content = format_github_job_summary(run_result)
    job_summary_path.write_text(job_summary_content)
    print(f"GitHub job summary written to: {job_summary_path}")

    github_step_summary = os.getenv("GITHUB_STEP_SUMMARY")
    if github_step_summary:
        step_summary_path = Path(github_step_summary)
        with step_summary_path.open("a") as f:
            f.write(job_summary_content)
        print(f"GitHub job summary also appended to: {step_summary_path}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ask Fern evaluation pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run", required=True)

    answer_parser = subparsers.add_parser(
        "answer",
        help="Generate answers for a suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  oculus answer --suite basic
  oculus answer --suite basic --run-id experiment_1
  oculus answer --suite basic --model command-a-03-2025
        """,
    )
    answer_parser.add_argument("--suite", type=str, required=True, help="Name of the evaluation suite")
    answer_parser.add_argument("--suite-path", type=Path, default=None, help="Base path to suites directory")
    answer_parser.add_argument("--run-id", type=str, default=None, help="Unique run identifier")
    answer_parser.add_argument(
        "--questions",
        type=str,
        default=None,
        help="Comma-separated question indices (1-based) or slugs (default: all questions)",
    )
    answer_parser.add_argument(
        "--integration",
        type=str,
        default=None,
        choices=["fai-local", "fai-http", "vercel-http"],
        help="Integration type (defaults to suite config)",
    )
    answer_parser.add_argument(
        "--model",
        type=str,
        default="claude-4-sonnet-20250514",
        choices=["claude-4-sonnet-20250514", "command-a-03-2025"],
        help="Model to use for answer generation",
    )
    answer_parser.add_argument("--max-workers", type=int, default=16, help="Number of parallel workers")
    answer_parser.add_argument("--no-skip-existing", action="store_true", help="Re-generate existing answers")

    evaluate_parser = subparsers.add_parser(
        "evaluate",
        help="Evaluate existing answers for a suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  oculus evaluate --suite basic --run-id experiment_1
  oculus evaluate --suite basic --run-id experiment_1 --judge-model claude-opus-4-20250514
        """,
    )
    evaluate_parser.add_argument("--suite", type=str, required=True, help="Name of the evaluation suite")
    evaluate_parser.add_argument("--suite-path", type=Path, default=None, help="Base path to suites directory")
    evaluate_parser.add_argument(
        "--run-id", type=str, required=True, help="Unique run identifier for answers to evaluate"
    )
    evaluate_parser.add_argument(
        "--questions",
        type=str,
        default=None,
        help="Comma-separated question indices (1-based) or slugs (default: all questions)",
    )
    evaluate_parser.add_argument(
        "--judge-model", type=str, default="claude-sonnet-4-5-20250929", help="Claude model for judging"
    )
    evaluate_parser.add_argument("--max-workers", type=int, default=16, help="Number of parallel workers")
    evaluate_parser.add_argument("--no-skip-existing", action="store_true", help="Re-generate existing evaluations")
    evaluate_parser.add_argument("--output-dir", type=Path, default=None, help="Directory to save results")
    evaluate_parser.add_argument(
        "--github-output", action="store_true", help="Generate GitHub-formatted output (requires --output-dir)"
    )

    run_parser = subparsers.add_parser(
        "run",
        help="Run evaluation on a suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  oculus run --suite basic
  oculus run --suite basic --run-id experiment_1
  oculus run --suite basic --model command-a-03-2025
        """,
    )
    run_parser.add_argument("--suite", type=str, required=True, help="Name of the evaluation suite")
    run_parser.add_argument("--suite-path", type=Path, default=None, help="Base path to suites directory")
    run_parser.add_argument("--run-id", type=str, default=None, help="Unique run identifier")
    run_parser.add_argument(
        "--questions",
        type=str,
        default=None,
        help="Comma-separated question indices (1-based) or slugs (default: all questions)",
    )
    run_parser.add_argument(
        "--integration",
        type=str,
        default=None,
        choices=["fai-local", "fai-http", "vercel-http"],
        help="Integration type (defaults to suite config)",
    )
    run_parser.add_argument(
        "--model",
        type=str,
        default="claude-4-sonnet-20250514",
        choices=["claude-4-sonnet-20250514", "command-a-03-2025"],
        help="Model to use for answer generation",
    )
    run_parser.add_argument(
        "--judge-model", type=str, default="claude-sonnet-4-5-20250929", help="Claude model for judging"
    )
    run_parser.add_argument("--max-workers", type=int, default=16, help="Number of parallel workers")
    run_parser.add_argument("--no-skip-existing", action="store_true", help="Re-generate existing answers/evaluations")
    run_parser.add_argument("--output-dir", type=Path, default=None, help="Directory to save results")
    run_parser.add_argument(
        "--github-output", action="store_true", help="Generate GitHub-formatted output (requires --output-dir)"
    )

    diff_parser = subparsers.add_parser(
        "diff",
        help="Generate fresh answers and compare against most recent run",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  oculus diff --suite payroc
  oculus diff --suite payroc --questions 1,2,3
  oculus diff --suite payroc --questions 01-test-ach-transaction-retrieve-batch,02-gain-access-sandbox
  oculus diff --suite payroc --model command-a-03-2025
        """,
    )
    diff_parser.add_argument("--suite", type=str, required=True, help="Name of the evaluation suite")
    diff_parser.add_argument("--suite-path", type=Path, default=None, help="Base path to suites directory")
    diff_parser.add_argument(
        "--questions",
        type=str,
        default=None,
        help="Comma-separated question indices (1-based) or slugs (default: all questions)",
    )
    diff_parser.add_argument(
        "--model",
        type=str,
        default="claude-4-sonnet-20250514",
        choices=["claude-4-sonnet-20250514", "command-a-03-2025"],
        help="Model to use for new answer generation",
    )
    diff_parser.add_argument(
        "--judge-model", type=str, default="claude-sonnet-4-5-20250929", help="Claude model for judging"
    )
    diff_parser.add_argument(
        "--integration",
        type=str,
        default=None,
        choices=["fai-local", "fai-http", "vercel-http"],
        help="Integration type (defaults to suite config or fai-local)",
    )
    diff_parser.add_argument("--max-workers", type=int, default=16, help="Number of parallel workers")
    diff_parser.add_argument("--diff-id", type=str, default=None, help="Unique diff identifier (default: timestamp)")
    diff_parser.add_argument(
        "--baseline",
        action="store_true",
        help="Compare against baseline run instead of ground truth (default: compare to ground truth)",
    )
    diff_parser.add_argument(
        "--baseline-run",
        type=str,
        default=None,
        help="Specific baseline run to compare against (default: most recent, requires --baseline)",
    )

    args = parser.parse_args()

    if args.command == "answer":
        return generate_answers_command(args)
    elif args.command == "evaluate":
        return evaluate_answers_command(args)
    elif args.command == "run":
        return run_evaluation(args)
    elif args.command == "diff":
        return diff_evaluation_command(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
