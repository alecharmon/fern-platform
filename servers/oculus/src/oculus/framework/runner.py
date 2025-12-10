import concurrent.futures
import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any

from oculus.framework.evaluators import (
    BinaryEvaluationResult,
    EvaluationResult,
    NumericEvaluationResult,
    ScaledEvaluationResult,
    get_evaluator,
)
from oculus.framework.models import (
    Answer,
    BinaryEvaluatorResult,
    CollectionConfig,
    Evaluation,
    EvaluationMetrics,
    EvaluationRun,
    NumericEvaluatorResult,
    Question,
    ScaledEvaluatorResult,
)
from oculus.framework.statistics import calculate_metrics
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
        collections: list[str] | None = None,
        evaluators: list[str] | None = None,
        run_id: str | None = None,
        max_workers: int = 16,
        collections_base_path: Path | None = None,
        results_base_path: Path | None = None,
    ):
        self.suite_name = suite_name
        self.suite_path = suite_path
        self.collections = collections or []
        self.evaluators = evaluators or ["correctness"]
        self.run_id = run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.max_workers = max_workers

        self.collections_base_path = collections_base_path or (suite_path.parent.parent / "collections")
        self.results_base_path = results_base_path or (suite_path.parent.parent / "results")

        self.results_dir = self.results_base_path / suite_name
        self.answers_dir = self.results_dir / "answers" / self.run_id

        self.answers_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def get_domains(self) -> set[str]:
        """Get all unique domains from the suite's collections.

        Returns a set of domain strings. Supports multi-domain suites.
        """
        if not self.collections:
            raise ValueError(f"No collections configured for suite '{self.suite_name}'")

        domains = set()
        for collection_name in self.collections:
            collection_config_path = self.collections_base_path / collection_name / "config.json"
            if not collection_config_path.exists():
                raise ValueError(f"Collection config not found: {collection_config_path}")

            collection_config = CollectionConfig(**load_json(collection_config_path))
            domains.add(collection_config.domain)

        return domains

    def _extract_subqueries(self, answer: Answer) -> list[str] | None:
        subqueries_str = (
            answer.metadata.get("subqueries")
            or answer.metadata.get("rewritten_queries")
            or answer.metadata.get("query_decomposition")
        )
        if not subqueries_str:
            return None

        try:
            subqueries = json.loads(subqueries_str)
            if isinstance(subqueries, list):
                return subqueries
        except (json.JSONDecodeError, TypeError):
            pass

        return None

    def _extract_source_urls(self, answer: Answer) -> list[str] | None:
        sources_str = answer.metadata.get("sources")
        if not sources_str:
            return None

        try:
            sources = json.loads(sources_str)
            if isinstance(sources, list):
                urls = [s.get("url") for s in sources if s.get("url")]
                return urls if urls else None
        except (json.JSONDecodeError, TypeError):
            pass

        return None

    def _serialize_answer(self, answer: Answer) -> dict[str, Any]:
        result = answer.model_dump()

        subqueries = self._extract_subqueries(answer)
        if subqueries:
            result["subqueries"] = subqueries
            for key in ["subqueries", "rewritten_queries", "query_decomposition"]:
                result["metadata"].pop(key, None)

        source_urls = self._extract_source_urls(answer)
        if source_urls:
            result["source_urls"] = source_urls
            result["metadata"].pop("sources", None)

        for key in list(result["metadata"].keys()):
            if key.endswith("_retrieved_documents"):
                try:
                    docs = json.loads(result["metadata"][key])
                    if isinstance(docs, list):
                        urls = [doc.get("url") for doc in docs if doc.get("url")]
                        if urls:
                            result["metadata"][f"{key.replace('_retrieved_documents', '')}_retrieved_urls"] = json.dumps(urls)
                        result["metadata"].pop(key)
                except (json.JSONDecodeError, TypeError):
                    pass

        return result

    def _serialize_evaluation_run(self, run: EvaluationRun) -> dict[str, Any]:
        """Serialize evaluation run with cleaned up metadata in evaluations."""
        result = run.model_dump()

        for eval_result in result["results"]:
            metadata = eval_result.get("metadata", {})

            subqueries_str = (
                metadata.get("subqueries")
                or metadata.get("rewritten_queries")
                or metadata.get("query_decomposition")
            )
            if subqueries_str:
                try:
                    subqueries = json.loads(subqueries_str)
                    if isinstance(subqueries, list):
                        eval_result["subqueries"] = subqueries
                        for key in ["subqueries", "rewritten_queries", "query_decomposition"]:
                            metadata.pop(key, None)
                except (json.JSONDecodeError, TypeError):
                    pass

            sources_str = metadata.get("sources")
            if sources_str:
                try:
                    sources = json.loads(sources_str)
                    if isinstance(sources, list):
                        urls = [s.get("url") for s in sources if s.get("url")]
                        if urls:
                            eval_result["source_urls"] = urls
                        metadata.pop("sources", None)
                except (json.JSONDecodeError, TypeError):
                    pass

            for key in list(metadata.keys()):
                if key.endswith("_retrieved_documents"):
                    try:
                        docs = json.loads(metadata[key])
                        if isinstance(docs, list):
                            urls = [doc.get("url") for doc in docs if doc.get("url")]
                            if urls:
                                metadata[f"{key.replace('_retrieved_documents', '')}_retrieved_urls"] = json.dumps(urls)
                            metadata.pop(key)
                    except (json.JSONDecodeError, TypeError):
                        pass

        return result

    def load_questions(self) -> list[Question]:
        """Load questions from all configured collections."""
        all_questions: list[Question] = []

        if not self.collections:
            raise ValueError(f"No collections configured for suite '{self.suite_name}'")

        for collection_name in self.collections:
            collection_base = self.collections_base_path / collection_name

            collection_config_path = collection_base / "config.json"
            if not collection_config_path.exists():
                raise ValueError(f"Collection config not found: {collection_config_path}")

            collection_config = CollectionConfig(**load_json(collection_config_path))

            collection_questions_path = collection_base / "questions"
            if not collection_questions_path.exists():
                raise ValueError(f"Collection questions directory not found: {collection_questions_path}")

            question_files = sorted(collection_questions_path.glob("*.json"), key=lambda f: f.stem)

            if not question_files:
                print(f"Warning: No questions found in collection '{collection_name}'")
                continue

            for question_file in question_files:
                question_data = load_json(question_file)
                question = Question(**question_data)

                question.metadata["domain"] = collection_config.domain
                question.metadata["collection"] = collection_name

                all_questions.append(question)

            print(f"Loaded {len(question_files)} questions from collection '{collection_name}' (domain: {collection_config.domain})")

        if not all_questions:
            raise ValueError(f"No questions loaded from any collections: {self.collections}")

        return all_questions

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
                save_json(answer_path, self._serialize_answer(answer))
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

            structured_evaluator_results: dict[
                str, BinaryEvaluatorResult | ScaledEvaluatorResult | NumericEvaluatorResult
            ] = {}
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
                elif isinstance(result, NumericEvaluationResult):
                    structured_evaluator_results[evaluator_name] = NumericEvaluatorResult(
                        is_passing=result.is_passing(),
                        reason=result.reason,
                        value=result.value,
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

    def calculate_metrics_by_collection(self, evaluations: list[Evaluation]) -> dict[str, EvaluationMetrics]:
        """Calculate metrics grouped by collection.

        Returns a dict mapping collection name to its metrics.
        """
        from collections import defaultdict

        evals_by_collection = defaultdict(list)
        for evaluation in evaluations:
            collection = evaluation.metadata.get("collection", "unknown")
            evals_by_collection[collection].append(evaluation)

        metrics_by_collection = {}
        for collection, collection_evals in evals_by_collection.items():
            metrics_by_collection[collection] = calculate_metrics(collection_evals)

        return metrics_by_collection
