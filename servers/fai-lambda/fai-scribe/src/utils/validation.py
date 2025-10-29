from typing import Any


def validate_body_param_or_throw(body: dict[str, Any], param_name: str) -> str:
    value = body.get(param_name)
    if not isinstance(value, str) or not value:
        raise ValueError(f"Missing required request body field: {param_name}")
    return value
