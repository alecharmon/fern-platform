import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from oculus.framework.generators import register_generator
from oculus.framework.models import Question
from oculus.utils.anthropic_utils import generate_with_claude
from oculus.utils.file_utils import save_json


class QuestionResponse(BaseModel):
    question: str
    ground_truth: str
    cited_context: str


GENERATE_QUESTION_PROMPT = (
    "You are an AI system responsible for generating a testing set of questions for a RAG system. "
    "Generate a question that is relevant to the document below, a ground_truth answer that an ideal "
    "system should return, and a cited_context that is relevant to the question and ground_truth answer. "
    "The question should be a single sentence from the user's perspective."
    "The markdown is presented below:\n\n"
    "{markdown}\n\n"
    "Return your response as JSON with fields 'question' (string), `ground_truth` (string), "
    "and 'cited_context' (string)."
)


def extract_slug_to_markdown_map(docs_definition: dict[str, Any]) -> dict[str, str]:
    slug_to_markdown = {}
    definition = docs_definition.get("definition", {})
    pages = definition.get("pages", {})

    for path, page_data in pages.items():
        slug = path.split("/")[-1].replace(".mdx", "")
        markdown = page_data.get("markdown", "")
        markdown = markdown.replace("{", "{{").replace("}", "}}")

        if markdown:
            slug_to_markdown[slug] = markdown

    return slug_to_markdown


def filter_changelog_slugs(slug_to_markdown: dict[str, str]) -> dict[str, str]:
    date_pattern_1 = re.compile(r"^\d{4}-\d{2}-\d{2}(\.md)?$")
    date_pattern_2 = re.compile(r"^\d{2}-\d{2}-\d{4}.*(\.md)?$")

    return {
        slug: content
        for slug, content in slug_to_markdown.items()
        if not date_pattern_1.match(slug) and not date_pattern_2.match(slug)
    }


def generate_question_for_page(slug: str, markdown: str, domain: str) -> Question | None:
    response = generate_with_claude(
        response_type=QuestionResponse,
        prompt_template=GENERATE_QUESTION_PROMPT,
        markdown=markdown,
        model="claude-opus-4-20250514",
        max_tokens=1000,
        max_retries=3,
    )

    if response is None:
        print(f"Warning: Failed to generate question for slug '{slug}'")
        return None

    return Question(
        question=response.question,
        ground_truth=response.ground_truth,
        metadata={
            "category": "markdown",
            "source": "markdown_generator",
            "slug": slug,
            "domain": domain,
            "cited_context": response.cited_context,
        },
    )


@register_generator("markdown")
def generate_markdown_questions(
    docs_definition: dict[str, Any],
    domain: str,
    questions_dir: Path | None = None,
    num_questions: int | None = None,
) -> list[Question]:
    slug_to_markdown = extract_slug_to_markdown_map(docs_definition)

    if not slug_to_markdown:
        print(f"Warning: No markdown pages found in docs definition for {domain}")
        return []

    filtered_slugs = filter_changelog_slugs(slug_to_markdown)

    if num_questions is not None and num_questions < len(filtered_slugs):
        filtered_slugs = dict(list(filtered_slugs.items())[:num_questions])
        print(f"Limited to {num_questions} markdown pages (filtered from {len(slug_to_markdown)} total)")
    else:
        print(f"Found {len(filtered_slugs)} markdown pages (filtered from {len(slug_to_markdown)} total)")

    total = len(filtered_slugs)
    completed = 0
    slug_to_question: dict[str, Question] = {}

    with ThreadPoolExecutor(max_workers=16) as executor:
        future_to_slug = {
            executor.submit(generate_question_for_page, slug, markdown, domain): slug
            for slug, markdown in filtered_slugs.items()
        }

        for future in as_completed(future_to_slug):
            slug = future_to_slug[future]
            completed += 1
            try:
                question = future.result()
                if question:
                    slug_to_question[slug] = question
                    if questions_dir:
                        sanitized_slug = slug.replace("/", "_").replace("\\", "_")
                        question_path = questions_dir / f"{sanitized_slug}.json"
                        save_json(question_path, question.model_dump())
                print(f"Progress: {completed}/{total} - Generated question for slug: {slug}")
            except Exception as e:
                print(f"Error generating question for slug '{slug}': {e}")

    sorted_slugs = sorted(slug_to_question.keys())
    questions = [slug_to_question[slug] for slug in sorted_slugs]

    print(f"Successfully generated {len(questions)} questions from markdown pages")
    return questions
