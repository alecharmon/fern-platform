import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

from oculus.framework.runner import EvaluationRunner
from oculus.integrations.fai_integration import create_fai_answer_function

load_dotenv()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run Ask Fern evaluations using LLM-as-a-judge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  oculus --suite retrieval_quality --domain buildwithfern.com
  oculus --suite answer_quality --domain docs.cohere.com --run-id experiment_1
  oculus --suite test --domain example.com --model command-a-03-2025
  oculus --suite test --domain example.com --no-skip-existing
        """,
    )

    parser.add_argument("--suite", type=str, required=True, help="Name of the evaluation suite")
    parser.add_argument("--domain", type=str, required=True, help="Documentation domain to query")
    parser.add_argument("--suite-path", type=Path, default=None, help="Base path to suites directory")
    parser.add_argument("--run-id", type=str, default=None, help="Unique run identifier")
    parser.add_argument(
        "--model",
        type=str,
        default="claude-4-sonnet-20250514",
        choices=["claude-4-sonnet-20250514", "command-a-03-2025"],
        help="Model to use for answer generation",
    )
    parser.add_argument("--judge-model", type=str, default="claude-opus-4-20250514", help="Claude model for judging")
    parser.add_argument("--max-workers", type=int, default=16, help="Number of parallel workers")
    parser.add_argument("--no-skip-existing", action="store_true", help="Re-generate existing answers/evaluations")
    parser.add_argument("--output-dir", type=Path, default=None, help="Directory to save results")

    args = parser.parse_args()

    if args.suite_path:
        suite_base = args.suite_path
    else:
        suite_base = Path.cwd() / "suites"

    suite_path = suite_base / args.suite

    if not suite_path.exists():
        print(f"Error: Suite directory not found: {suite_path}", file=sys.stderr)
        print(f"\nExpected structure:", file=sys.stderr)
        print(f"  {suite_path}/", file=sys.stderr)
        print(f"    questions/", file=sys.stderr)
        print(f"      question_0.json", file=sys.stderr)
        return 1

    questions_dir = suite_path / "questions"
    if not questions_dir.exists() or not any(questions_dir.glob("*.json")):
        print(f"Error: No questions found in {questions_dir}", file=sys.stderr)
        return 1

    try:
        print(f"Initializing FAI integration for domain: {args.domain}")
        answer_fn = create_fai_answer_function(domain=args.domain, model=args.model)

        runner = EvaluationRunner(
            suite_name=args.suite,
            suite_path=suite_path,
            run_id=args.run_id,
            max_workers=args.max_workers,
        )

        result = runner.run(
            answer_fn=answer_fn,
            model_name=args.model,
            judge_model=args.judge_model,
            skip_existing=not args.no_skip_existing,
        )

        if args.output_dir:
            from oculus.utils.file_utils import save_json

            args.output_dir.mkdir(parents=True, exist_ok=True)
            output_path = args.output_dir / f"results_{result.run_id}.json"
            save_json(output_path, result.model_dump())
            print(f"\nAdditional output saved to: {output_path}")

        return 0

    except ImportError as e:
        print(f"\nError: Failed to import required modules", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        print(f"\nMake sure:", file=sys.stderr)
        print(f"  1. FAI dependencies are installed (poetry install in servers/fai)", file=sys.stderr)
        print(f"  2. PYTHONPATH includes the FAI source directory", file=sys.stderr)
        return 1

    except Exception as e:
        print(f"\nError: Evaluation failed", file=sys.stderr)
        print(f"{e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
