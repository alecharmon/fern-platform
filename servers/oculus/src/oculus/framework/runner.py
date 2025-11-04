import concurrent.futures
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from oculus.framework.judge import evaluate_answer
from oculus.framework.models import Answer, Evaluation, EvaluationMetrics, EvaluationRun, Question
from oculus.utils.file_utils import load_json, load_json_files, save_json


class EvaluationRunner:
    def __init__(
        self,
        suite_name: str,
        suite_path: Path,
        run_id: Optional[str] = None,
        max_workers: int = 16,
    ):
        self.suite_name = suite_name
        self.suite_path = suite_path
        self.run_id = run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.max_workers = max_workers

        self.questions_dir = suite_path / "questions"
        self.answers_dir = suite_path / "answers" / self.run_id
        self.evals_dir = suite_path / "evals" / self.run_id

        self.answers_dir.mkdir(parents=True, exist_ok=True)
        self.evals_dir.mkdir(parents=True, exist_ok=True)

    def load_questions(self) -> list[Question]:
        question_files = sorted(self.questions_dir.glob("*.json"))
        return [Question(**load_json(f)) for f in question_files]

    def generate_answers(
        self,
        questions: list[Question],
        answer_fn: Callable[[str], str],
        model_name: str = "fai",
        skip_existing: bool = True,
    ) -> list[Answer]:
        answers = []
        pending_questions = []
        for i, question in enumerate(questions):
            answer_path = self.answers_dir / f"question_{i}.json"

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
                answer_text = answer_fn(question.question)
                answer = Answer(
                    question=question.question,
                    answer=answer_text,
                    model=model_name,
                    metadata=question.metadata,
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

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(generate_single_answer, item): item for item in pending_questions}

            for future in concurrent.futures.as_completed(futures):
                idx, answer = future.result()
                answers.append((idx, answer))

                answer_path = self.answers_dir / f"question_{idx}.json"
                save_json(answer_path, answer.model_dump())

        print(f"Generated {len(pending_questions)} answers")
        answers.sort(key=lambda x: x[0])
        return [answer for _, answer in answers]

    def evaluate_answers(
        self,
        questions: list[Question],
        answers: list[Answer],
        judge_model: str = "claude-opus-4-20250514",
        skip_existing: bool = True,
    ) -> list[Evaluation]:
        question_map = {q.question: q for q in questions}
        evaluations = []
        pending_answers = []

        for i, answer in enumerate(answers):
            eval_path = self.evals_dir / f"question_{i}.json"

            if skip_existing and eval_path.exists():
                try:
                    eval_data = load_json(eval_path)
                    evaluations.append((i, Evaluation(**eval_data)))
                    continue
                except Exception as e:
                    print(f"Warning: Failed to load existing evaluation {eval_path}: {e}")

            pending_answers.append((i, answer))

        if not pending_answers:
            print(f"All {len(answers)} evaluations already exist, skipping")
            evaluations.sort(key=lambda x: x[0])
            return [evaluation for _, evaluation in evaluations]

        print(f"Evaluating {len(pending_answers)} answers...")

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
                    reason="No ground truth available",
                    metadata=answer.metadata,
                )

            try:
                eval_response = evaluate_answer(
                    question=answer.question,
                    answer=answer.answer,
                    ground_truth=question_obj.ground_truth,
                    model=judge_model,
                )

                if not eval_response:
                    return idx, Evaluation(
                        question=answer.question,
                        answer=answer.answer,
                        ground_truth=question_obj.ground_truth,
                        is_correct=False,
                        reason="Evaluation failed",
                        metadata=answer.metadata,
                    )

                return idx, Evaluation(
                    question=answer.question,
                    answer=answer.answer,
                    ground_truth=question_obj.ground_truth,
                    is_correct=eval_response.is_correct,
                    reason=eval_response.reason,
                    metadata=answer.metadata,
                )

            except Exception as e:
                print(f"Error evaluating answer {idx}: {e}")
                return idx, Evaluation(
                    question=answer.question,
                    answer=answer.answer,
                    ground_truth=question_obj.ground_truth,
                    is_correct=False,
                    reason=f"ERROR: {str(e)}",
                    metadata=answer.metadata,
                )

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(evaluate_single_answer, item): item for item in pending_answers}

            for future in concurrent.futures.as_completed(futures):
                idx, evaluation = future.result()
                evaluations.append((idx, evaluation))

                eval_path = self.evals_dir / f"question_{idx}.json"
                save_json(eval_path, evaluation.model_dump())

        print(f"Evaluated {len(pending_answers)} answers")
        evaluations.sort(key=lambda x: x[0])
        return [evaluation for _, evaluation in evaluations]

    def calculate_metrics(self, evaluations: list[Evaluation]) -> EvaluationMetrics:
        total_questions = len(evaluations)
        total_correct = sum(1 for e in evaluations if e.is_correct)
        accuracy = total_correct / total_questions if total_questions > 0 else 0.0

        return EvaluationMetrics(
            total_questions=total_questions,
            total_correct=total_correct,
            accuracy=accuracy,
        )

    def run(
        self,
        answer_fn: Callable[[str], str],
        model_name: str = "fai",
        judge_model: str = "claude-opus-4-20250514",
        skip_existing: bool = True,
    ) -> EvaluationRun:
        print(f"\n{'='*60}")
        print(f"Starting evaluation run: {self.run_id}")
        print(f"Suite: {self.suite_name}")
        print(f"{'='*60}\n")

        print("Stage 1: Loading questions...")
        questions = self.load_questions()
        print(f"Loaded {len(questions)} questions\n")

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

        results_path = self.suite_path / f"results_{self.run_id}.json"
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
