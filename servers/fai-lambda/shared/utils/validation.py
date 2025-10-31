from typing import Any, Type, TypeVar, get_origin

T = TypeVar("T")


def validate_body_param_or_throw(body: dict[str, Any], param_name: str, expected_type: Type[T] = str) -> T:
    value = body.get(param_name)

    if value is None:
        raise ValueError(f"Missing required request body field: {param_name}")

    origin = get_origin(expected_type)
    if origin is not None:
        if not isinstance(value, origin):
            raise ValueError(f"Field '{param_name}' must be of type {expected_type}, got {type(value).__name__}")
    else:
        if not isinstance(value, expected_type):
            raise ValueError(f"Field '{param_name}' must be of type {expected_type.__name__}, got {type(value).__name__}")

    return value
