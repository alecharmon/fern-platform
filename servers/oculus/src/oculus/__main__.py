import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

import oculus.evaluators.citation  # noqa: F401
import oculus.evaluators.coherence  # noqa: F401
import oculus.evaluators.conciseness  # noqa: F401
import oculus.evaluators.correctness  # noqa: F401
import oculus.generators.endpoints  # noqa: F401
import oculus.generators.markdown  # noqa: F401
from oculus.framework.models import (
    Answer,
    EvaluationRun,
    SuiteConfig,
)
from oculus.framework.runner import EvaluationRunner
from oculus.integrations.base import create_answer_function
from oculus.integrations.factory import create_integration, get_default_integration_type
from oculus.utils.file_utils import (
    load_json,
    save_json,
)
from oculus.utils.github_formatter import format_github_job_summary, format_github_summary

load_dotenv()


def generate_questions(args: argparse.Namespace) -> int:
    """Generate questions for a suite using configured generators."""
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

    if not suite_config.generators:
        print(f"Suite '{args.suite}' has no generators configured. Nothing to generate.")
        return 0

    try:
        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            domain=suite_config.domain,
            generators=suite_config.generators,
            evaluators=suite_config.evaluators,
            num_questions_generation=suite_config.num_questions_generation,
            generator_config=suite_config.generator_config,
        )

        runner.generate_and_save_questions()
        return 0

    except Exception as e:
        print("\nError: Question generation failed", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


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

    questions_dir = suite_path / "questions"
    if not questions_dir.exists() or not any(questions_dir.glob("*.json")):
        print(f"Error: No questions found in {questions_dir}", file=sys.stderr)
        print(f"Hint: Run 'oculus generate --suite {args.suite}' first to generate questions", file=sys.stderr)
        return 1

    try:
        integration_type = args.integration if hasattr(args, "integration") else get_default_integration_type()
        print(f"Initializing {integration_type} integration for domain: {suite_config.domain}")
        integration = create_integration(
            integration_type=integration_type, domain=suite_config.domain, model=args.model
        )
        answer_fn = create_answer_function(integration)

        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            domain=suite_config.domain,
            generators=suite_config.generators,
            evaluators=suite_config.evaluators,
            run_id=args.run_id,
            max_workers=args.max_workers,
            num_questions_generation=suite_config.num_questions_generation,
            generator_config=suite_config.generator_config,
        )

        print(f"\n{'='*60}")
        print(f"Generating answers: {runner.run_id}")
        print(f"Suite: {args.suite}")
        print(f"Domain: {suite_config.domain}")
        print(f"Model: {args.model}")
        print(f"{'='*60}\n")

        print("Loading questions...")
        questions = runner.load_questions()
        print(f"Total questions: {len(questions)}\n")

        print("Generating answers...")
        runner.generate_answers(
            questions=questions,
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

    questions_dir = suite_path / "questions"
    if not questions_dir.exists() or not any(questions_dir.glob("*.json")):
        print(f"Error: No questions found in {questions_dir}", file=sys.stderr)
        print(f"Hint: Run 'oculus generate --suite {args.suite}' first", file=sys.stderr)
        return 1

    try:
        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            domain=suite_config.domain,
            generators=suite_config.generators,
            evaluators=suite_config.evaluators,
            run_id=args.run_id,
            max_workers=args.max_workers,
            num_questions_generation=suite_config.num_questions_generation,
            generator_config=suite_config.generator_config,
        )

        if not runner.answers_dir.exists() or not any(runner.answers_dir.glob("*.json")):
            print(f"Error: No answers found in {runner.answers_dir}", file=sys.stderr)
            print(f"Hint: Run 'oculus answer --suite {args.suite} --run-id {args.run_id}' first", file=sys.stderr)
            return 1

        print(f"\n{'='*60}")
        print(f"Evaluating answers: {runner.run_id}")
        print(f"Suite: {args.suite}")
        print(f"Domain: {suite_config.domain}")
        print(f"Evaluators: {suite_config.evaluators}")
        print(f"{'='*60}\n")

        print("Loading questions...")
        questions = runner.load_questions()
        print(f"Total questions: {len(questions)}\n")

        print("Loading answers...")
        answer_files = sorted(runner.answers_dir.glob("*.json"), key=lambda f: f.stem)
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

    questions_dir = suite_path / "questions"
    if not questions_dir.exists() or not any(questions_dir.glob("*.json")):
        print(f"Error: No questions found in {questions_dir}", file=sys.stderr)
        if suite_config.generators:
            print(f"Hint: Run 'oculus generate --suite {args.suite}' first to generate questions", file=sys.stderr)
        return 1

    try:
        integration_type = args.integration if hasattr(args, "integration") else get_default_integration_type()
        print(f"Initializing {integration_type} integration for domain: {suite_config.domain}")
        integration = create_integration(
            integration_type=integration_type, domain=suite_config.domain, model=args.model
        )
        answer_fn = create_answer_function(integration)

        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            domain=suite_config.domain,
            generators=suite_config.generators,
            evaluators=suite_config.evaluators,
            run_id=args.run_id,
            max_workers=args.max_workers,
            num_questions_generation=suite_config.num_questions_generation,
            generator_config=suite_config.generator_config,
        )

        result = runner.run(
            answer_fn=answer_fn,
            model_name=args.model,
            judge_model=args.judge_model,
            skip_existing=not args.no_skip_existing,
        )

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

    generate_parser = subparsers.add_parser(
        "generate",
        help="Generate questions for a suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  oculus generate --suite basic
        """,
    )
    generate_parser.add_argument("--suite", type=str, required=True, help="Name of the evaluation suite")
    generate_parser.add_argument("--suite-path", type=Path, default=None, help="Base path to suites directory")

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
        "--integration",
        type=str,
        default=None,
        choices=["fai-local", "fai-http", "vercel-http"],
        help="Integration type (defaults to OCULUS_INTEGRATION env var or fai-local)",
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
        "--integration",
        type=str,
        default=None,
        choices=["fai-local", "fai-http", "vercel-http"],
        help="Integration type (defaults to OCULUS_INTEGRATION env var or fai-local)",
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

    args = parser.parse_args()

    if args.command == "generate":
        return generate_questions(args)
    elif args.command == "answer":
        return generate_answers_command(args)
    elif args.command == "evaluate":
        return evaluate_answers_command(args)
    elif args.command == "run":
        return run_evaluation(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
