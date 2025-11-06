from typing import Any

from oculus.framework.generators import register_generator
from oculus.framework.models import Question

QUESTION_TEMPLATES = [
    "Tell me about the {method} {path} endpoint.",
    "What does the {operationId} endpoint do?",
    "What are the parameters for the {method} {path} endpoint?",
    "What are available responses for the {method} {path} endpoint?",
    "What parameters are required for the {method} {path} endpoint?",
    "What parameters are optional for the {method} {path} endpoint?",
    "Tell me about the {first_request_property} request body property for the {method} {path} endpoint.",
    "Tell me about the {first_response_property} response property for the {method} {path} endpoint.",
]


def extract_operation_id(spec: dict[str, Any], method: str, path: str) -> str | None:
    for path_key, path_item in spec.get("paths", {}).items():
        if path_key == path:
            operation = path_item.get(method, {})
            operation_id = operation.get("operationId")
            return str(operation_id) if operation_id is not None else None
    return None


def extract_first_request_property(spec: dict[str, Any], method: str, path: str) -> str | None:
    for path_key, path_item in spec.get("paths", {}).items():
        if path_key == path:
            operation = path_item.get(method, {})
            request_body = operation.get("requestBody", {})
            content = request_body.get("content", {})

            for content_type in ["application/json", "application/x-www-form-urlencoded", "multipart/form-data"]:
                if content_type in content and content[content_type] is not None:
                    schema = content[content_type].get("schema", {})
                    properties = schema.get("properties", {})
                    if properties:
                        first_key = next(iter(properties.keys()))
                        return str(first_key)
    return None


def extract_first_response_property(spec: dict[str, Any], method: str, path: str) -> str | None:
    for path_key, path_item in spec.get("paths", {}).items():
        if path_key == path:
            operation = path_item.get(method, {})
            responses = operation.get("responses", {})

            for status_code in ["200", "201", "202", "204", "default"]:
                if status_code in responses:
                    response = responses[status_code]
                    content = response.get("content", {})

                    for content_type in ["application/json", "text/plain", "application/xml"]:
                        if content_type in content and content[content_type] is not None:
                            schema = content[content_type].get("schema", {})
                            properties = schema.get("properties", {})
                            if properties:
                                first_key = next(iter(properties.keys()))
                                return str(first_key)
    return None


def extract_endpoint_spec(spec: dict[str, Any], method: str, path: str) -> dict[str, Any] | None:
    for path_key, path_item in spec.get("paths", {}).items():
        if path_key == path:
            operation = path_item.get(method, {})
            return operation  # type: ignore[no-any-return]
    return None


def generate_questions_for_endpoint(
    method: str,
    path: str,
    spec: dict[str, Any],
) -> list[tuple[str, dict[str, Any]]]:
    questions = []

    operation_id = extract_operation_id(spec, method, path)
    first_request_property = extract_first_request_property(spec, method, path)
    first_response_property = extract_first_response_property(spec, method, path)

    context = {
        "method": method.upper(),
        "path": path,
        "operationId": operation_id,
        "first_request_property": first_request_property,
        "first_response_property": first_response_property,
    }

    endpoint_spec = extract_endpoint_spec(spec, method, path)

    for template in QUESTION_TEMPLATES:
        try:
            placeholders = [word[1:-1] for word in template.split() if word.startswith("{") and word.endswith("}")]

            if all(context.get(p) is not None for p in placeholders):
                question = template.format(**context)
                questions.append((question, endpoint_spec or {}))
        except KeyError:
            continue

    return questions


def extract_openapi_spec_from_docs_definition(docs_definition: dict[str, Any]) -> dict[str, Any] | None:
    definition = docs_definition.get("definition", {})

    if "apis" in definition:
        for api in definition["apis"]:
            if "spec" in api:
                return api["spec"]  # type: ignore[no-any-return]

    if "pages" in definition:
        for path, page_data in definition["pages"].items():
            if "api" in page_data and "spec" in page_data["api"]:
                return page_data["api"]["spec"]  # type: ignore[no-any-return]

    return None


@register_generator("openapi")
def generate_openapi_questions(
    docs_definition: dict[str, Any],
    domain: str,
    source_path: str | None = None,
    questions_dir: Any = None,
    num_questions: int | None = None,
    **kwargs: Any,
) -> list[Question]:
    if source_path:
        from pathlib import Path

        spec_file = Path(source_path)
        if not spec_file.exists():
            print(f"Error: OpenAPI spec file not found: {source_path}")
            return []

        import json

        with open(spec_file) as f:
            openapi_spec = json.load(f)
        print(f"Loaded OpenAPI spec from: {source_path}")
    else:
        openapi_spec = extract_openapi_spec_from_docs_definition(docs_definition)

        if not openapi_spec:
            print(f"Warning: No OpenAPI spec found in docs definition for {domain}")
            return []

    from pathlib import Path

    from oculus.utils.file_utils import save_json

    questions: list[Question] = []
    paths = openapi_spec.get("paths", {})
    total_endpoints = sum(
        1 for path_item in paths.values() for method in ["get", "post", "put", "patch", "delete"] if method in path_item
    )
    completed = 0
    question_counter = 0

    for path, path_item in paths.items():
        if num_questions is not None and len(questions) >= num_questions:
            break

        for method in ["get", "post", "put", "patch", "delete"]:
            if num_questions is not None and len(questions) >= num_questions:
                break

            if method in path_item:
                question_tuples = generate_questions_for_endpoint(method, path, openapi_spec)

                for question_text, endpoint_spec in question_tuples:
                    if num_questions is not None and len(questions) >= num_questions:
                        break

                    import json

                    endpoint_slug = f"{method.upper()}_{path}".replace("/", "_").replace("{", "").replace("}", "")
                    slug = f"{endpoint_slug}_{question_counter}"
                    question_counter += 1

                    question = Question(
                        question=question_text,
                        ground_truth=json.dumps(endpoint_spec, indent=2),
                        metadata={
                            "category": "api",
                            "source": "openapi_generator",
                            "method": method.upper(),
                            "path": path,
                            "slug": slug,
                        },
                    )
                    questions.append(question)

                    if questions_dir:
                        sanitized_slug = slug.replace("/", "_").replace("\\", "_")
                        question_path = Path(questions_dir) / f"{sanitized_slug}.json"
                        save_json(question_path, question.model_dump())

                completed += 1
                if num_questions is not None:
                    print(
                        f"Progress: {len(questions)}/{num_questions} - "
                        f"Generated questions for {method.upper()} {path}"
                    )
                else:
                    print(f"Progress: {completed}/{total_endpoints} - Generated questions for {method.upper()} {path}")

    print(f"Generated {len(questions)} questions from OpenAPI spec")
    return questions
