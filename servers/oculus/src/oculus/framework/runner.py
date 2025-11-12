import concurrent.futures
import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any

from oculus.framework.evaluators import (
    BinaryEvaluationResult,
    EvaluationResult,
    ScaledEvaluationResult,
    get_evaluator,
)
from oculus.framework.generators import get_generator
from oculus.framework.models import (
    Answer,
    BinaryEvaluatorResult,
    Evaluation,
    EvaluationMetrics,
    EvaluationRun,
    GeneratorConfig,
    Question,
    ScaledEvaluatorResult,
)
from oculus.framework.statistics import calculate_metrics
from oculus.utils.docs_definition import get_docs_definition_for_domain
from oculus.utils.file_utils import (
    load_json,
    save_json,
)


def _parse_sources_from_answer(answer: Answer) -> list[dict[str, str | None]] | None:
    """
    Parse sources from answer metadata.

    Returns list of dicts with 'url', 'slug', 'title' keys, or None if not found.
    """
    if "sources" not in answer.metadata:
        return None

    try:
        sources = json.loads(answer.metadata["sources"])
        if isinstance(sources, list):
            return sources
    except (json.JSONDecodeError, TypeError):
        pass

    return None


class EvaluationRunner:
    def __init__(
        self,
        suite_name: str,
        suite_path: Path,
        domain: str,
        generators: list[str] | None = None,
        evaluators: list[str] | None = None,
        run_id: str | None = None,
        max_workers: int = 16,
        num_questions_generation: int | None = None,
        generator_config: "GeneratorConfig | None" = None,
        results_base_path: Path | None = None,
    ):
        self.suite_name = suite_name
        self.suite_path = suite_path
        self.domain = domain
        self.generators = generators or []
        self.evaluators = evaluators or ["correctness"]
        self.run_id = run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.max_workers = max_workers
        self.num_questions_generation = num_questions_generation
        self.generator_config = generator_config

        self.results_base_path = results_base_path or (suite_path.parent.parent / "results")

        self.questions_dir = suite_path / "questions"
        self.results_dir = self.results_base_path / suite_name
        self.answers_dir = self.results_dir / "answers" / self.run_id

        self.answers_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def generate_and_save_questions(self) -> None:
        if not self.generators:
            print("No generators configured")
            return

        print(f"{'='*60}")
        print("QUESTION GENERATION")
        print(f"{'='*60}\n")
        print(f"Suite: {self.suite_name}")
        print(f"Domain: {self.domain}")
        print(f"Generators: {self.generators}\n")

        print(f"Fetching docs definition for domain: {self.domain}")
        docs_definition = get_docs_definition_for_domain(self.domain)

        all_questions: list[Question] = []

        self.questions_dir.mkdir(parents=True, exist_ok=True)
        for existing_file in self.questions_dir.glob("*.json"):
            existing_file.unlink()

        for generator_name in self.generators:
            print(f"\nRunning generator: {generator_name}")
            generator_fn = get_generator(generator_name)

            if not generator_fn:
                print(f"Warning: Generator '{generator_name}' not found, skipping")
                continue

            gen_config = None
            if self.generator_config:
                if generator_name == "openapi" and self.generator_config.openapi:
                    gen_config = {"source_path": self.generator_config.openapi.source_path}

            try:
                kwargs: dict[str, Any] = {
                    "questions_dir": self.questions_dir,
                    "num_questions": self.num_questions_generation,
                }
                if gen_config:
                    kwargs.update(gen_config)

                questions = generator_fn(docs_definition, self.domain, **kwargs)
                all_questions.extend(questions)
                print(f"Generator '{generator_name}' produced {len(questions)} questions")
            except TypeError:
                questions = generator_fn(docs_definition, self.domain)
                all_questions.extend(questions)
                print(f"Generator '{generator_name}' produced {len(questions)} questions")
            except Exception as e:
                print(f"Error running generator '{generator_name}': {e}")
                import traceback

                traceback.print_exc()
                continue

        if not all_questions:
            print("\nNo questions generated")
            return

        print(f"\n{'='*60}")
        print(f"Saved {len(all_questions)} questions to {self.questions_dir}")
        print(f"{'='*60}\n")

    def load_questions(self) -> list[Question]:
        question_files = sorted(self.questions_dir.glob("*.json"), key=lambda f: f.stem)
        if not question_files:
            raise ValueError(f"No questions found in {self.questions_dir}")
        return [Question(**load_json(f)) for f in question_files]

    def generate_answers(
        self,
        questions: list[Question],
        answer_fn: Callable[[str], tuple[str, dict[str, str]]],
        model_name: str = "fai",
        skip_existing: bool = True,
    ) -> list[Answer]:
        answers = []
        pending_questions = []
        for i, question in enumerate(questions):
            slug = question.metadata.get("slug", f"question_{i}")
            sanitized_slug = slug.replace("/", "_").replace("\\", "_")
            answer_path = self.answers_dir / f"{sanitized_slug}.json"

            if skip_existing and answer_path.exists():
                try:
                    answer_data = load_json(answer_path)
                    answers.append((i, Answer(**answer_data)))
                    continue
                except Exception as e:
                    print(f"Warning: Failed to load existing answer {answer_path}: {e}")

            pending_questions.append((i, question))

        if not pending_questions:
            print(f"All {len(questions)} answers already exist, skipping generation")
            answers.sort(key=lambda x: x[0])
            return [answer for _, answer in answers]

        print(f"Generating {len(pending_questions)} answers...")

        def generate_single_answer(item: tuple[int, Question]) -> tuple[int, Answer]:
            idx, question = item
            try:
                answer_text, additional_metadata = answer_fn(question.question)
                merged_metadata = {**question.metadata, **additional_metadata}

                answer = Answer(
                    question=question.question,
                    answer=answer_text,
                    model=model_name,
                    metadata=merged_metadata,
                )
                return idx, answer
            except Exception as e:
                print(f"Error generating answer for question {idx}: {e}")
                return idx, Answer(
                    question=question.question,
                    answer=f"ERROR: {str(e)}",
                    model=model_name,
                    metadata=question.metadata,
                )

        total = len(pending_questions)
        completed = 0

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(generate_single_answer, item): item for item in pending_questions}

            for future in concurrent.futures.as_completed(futures):
                idx, answer = future.result()
                answers.append((idx, answer))
                completed += 1

                slug = answer.metadata.get("slug", f"question_{idx}")
                sanitized_slug = slug.replace("/", "_").replace("\\", "_")
                answer_path = self.answers_dir / f"{sanitized_slug}.json"
                save_json(answer_path, answer.model_dump())
                print(f"Progress: {completed}/{total} - Generated answer for slug: {slug}")

        print(f"Generated {len(pending_questions)} answers")
        answers.sort(key=lambda x: x[0])
        return [answer for _, answer in answers]

    def evaluate_answers(
        self,
        questions: list[Question],
        answers: list[Answer],
        judge_model: str = "claude-sonnet-4-5-20250929",
        skip_existing: bool = True,
    ) -> list[Evaluation]:
        question_map = {q.question: q for q in questions}
        evaluations = []
        pending_answers = [(i, answer) for i, answer in enumerate(answers)]

        print(f"Evaluating {len(pending_answers)} answers with evaluators: {self.evaluators}...")

        def evaluate_single_answer(item: tuple[int, Answer]) -> tuple[int, Evaluation]:
            idx, answer = item
            question_obj = question_map.get(answer.question)
            if not question_obj:
                print(f"Warning: No ground truth found for question: {answer.question}")
                return idx, Evaluation(
                    question=answer.question,
                    answer=answer.answer,
                    ground_truth="UNKNOWN",
                    is_correct=False,
                    metadata=answer.metadata,
                )

            evaluator_results: list[tuple[str, EvaluationResult]] = []
            all_correct = True

            for evaluator_name in self.evaluators:
                evaluator_fn = get_evaluator(evaluator_name)

                if not evaluator_fn:
                    print(f"Warning: Evaluator '{evaluator_name}' not found, skipping")
                    continue

                try:
                    actual_sources = _parse_sources_from_answer(answer)

                    evaluator_criteria = None
                    if (
                        question_obj.criteria
                        and evaluator_name in question_obj.criteria
                        and len(question_obj.criteria[evaluator_name]) > 0
                    ):
                        evaluator_criteria = question_obj.criteria[evaluator_name]

                    eval_result: EvaluationResult | None = evaluator_fn(
                        question=answer.question,
                        answer=answer.answer,
                        ground_truth=question_obj.ground_truth,
                        model=judge_model,
                        actual_sources=actual_sources,
                        criteria=evaluator_criteria,
                    )

                    if eval_result:
                        evaluator_results.append((evaluator_name, eval_result))
                        all_correct = all_correct and eval_result.is_passing()
                    else:
                        all_correct = False

                except Exception as e:
                    print(f"Error running evaluator '{evaluator_name}' on answer {idx}: {e}")
                    all_correct = False

            if not evaluator_results:
                return idx, Evaluation(
                    question=answer.question,
                    answer=answer.answer,
                    ground_truth=question_obj.ground_truth,
                    is_correct=False,
                    metadata=answer.metadata,
                )

            # Convert EvaluationResult to structured EvaluatorResult
            structured_evaluator_results: dict[str, BinaryEvaluatorResult | ScaledEvaluatorResult] = {}
            for evaluator_name, result in evaluator_results:
                if isinstance(result, BinaryEvaluationResult):
                    structured_evaluator_results[evaluator_name] = BinaryEvaluatorResult(
                        is_passing=result.is_passing(),
                        reason=result.reason,
                    )
                elif isinstance(result, ScaledEvaluationResult):
                    structured_evaluator_results[evaluator_name] = ScaledEvaluatorResult(
                        is_passing=result.is_passing(),
                        reason=result.reason,
                        score=result.score,
                        min_score=result.min_score,
                        max_score=result.max_score,
                        passing_threshold=result.passing_threshold,
                    )

            return idx, Evaluation(
                question=answer.question,
                answer=answer.answer,
                ground_truth=question_obj.ground_truth,
                is_correct=all_correct,
                metadata=answer.metadata,
                evaluator_results=structured_evaluator_results,
            )

        total = len(pending_answers)
        completed = 0

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(evaluate_single_answer, item): item for item in pending_answers}

            for future in concurrent.futures.as_completed(futures):
                idx, evaluation = future.result()
                evaluations.append((idx, evaluation))
                completed += 1

                slug = evaluation.metadata.get("slug", f"question_{idx}")
                print(f"Progress: {completed}/{total} - Evaluated slug: {slug}")

        print(f"Evaluated {len(pending_answers)} answers")
        evaluations.sort(key=lambda x: x[0])
        return [evaluation for _, evaluation in evaluations]

    def calculate_metrics(self, evaluations: list[Evaluation]) -> EvaluationMetrics:
        return calculate_metrics(evaluations)

    def run(
        self,
        answer_fn: Callable[[str], tuple[str, dict[str, str]]],
        model_name: str = "fai",
        judge_model: str = "claude-sonnet-4-5-20250929",
        skip_existing: bool = True,
    ) -> EvaluationRun:
        print(f"\n{'='*60}")
        print(f"Starting evaluation run: {self.run_id}")
        print(f"Suite: {self.suite_name}")
        print(f"Domain: {self.domain}")
        print(f"{'='*60}\n")

        print("Stage 1: Loading questions...")
        questions = self.load_questions()
        print(f"Total questions: {len(questions)}\n")

        print("Stage 2: Generating answers...")
        answers = self.generate_answers(
            questions=questions,
            answer_fn=answer_fn,
            model_name=model_name,
            skip_existing=skip_existing,
        )
        print()

        print("Stage 3: Evaluating answers...")
        evaluations = self.evaluate_answers(
            questions=questions,
            answers=answers,
            judge_model=judge_model,
            skip_existing=skip_existing,
        )
        print()

        print("Stage 4: Calculating metrics...")
        metrics = self.calculate_metrics(evaluations)

        run_result = EvaluationRun(
            run_id=self.run_id,
            timestamp=datetime.now().isoformat(),
            suite=self.suite_name,
            results=evaluations,
            metrics=metrics,
        )

        results_path = self.results_dir / f"results_{self.run_id}.json"
        save_json(results_path, run_result.model_dump())
        print(f"Saved results to {results_path}\n")

        print(f"{'='*60}")
        print("EVALUATION SUMMARY")
        print(f"{'='*60}")
        print(f"Suite: {self.suite_name}")
        print(f"Run ID: {self.run_id}")
        print(f"Total Questions: {metrics.total_questions}")
        print(f"Total Correct: {metrics.total_correct}")
        print(f"Accuracy: {metrics.accuracy:.2%}")
        print(f"{'='*60}\n")

        return run_result
