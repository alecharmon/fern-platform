from typing import Any, Optional

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


def extract_operation_id(spec: dict[str, Any], method: str, path: str) -> Optional[str]:
    for path_key, path_item in spec.get("paths", {}).items():
        if path_key == path:
            operation = path_item.get(method, {})
            operation_id = operation.get("operationId")
            return str(operation_id) if operation_id is not None else None
    return None


def extract_first_request_property(spec: dict[str, Any], method: str, path: str) -> Optional[str]:
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


def extract_first_response_property(spec: dict[str, Any], method: str, path: str) -> Optional[str]:
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

    for template in QUESTION_TEMPLATES:
        try:
            placeholders = [word[1:-1] for word in template.split() if word.startswith("{") and word.endswith("}")]

            if all(context.get(p) is not None for p in placeholders):
                question = template.format(**context)
                questions.append((question, spec))
        except KeyError:
            continue

    return questions
