import time
from typing import (
    Any,
    TypeVar,
    cast,
)

from anthropic import Anthropic
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def generate_with_claude(
    response_type: type[T],
    prompt_template: str,
    model: str = "claude-opus-4-20250514",
    max_tokens: int = 1000,
    max_retries: int = 3,
    **kwargs: str,
) -> T | None:
    """
    Generate a structured response using Claude with tool calling.

    Args:
        response_type: Pydantic model class for the expected response structure
        prompt_template: Template string with placeholders for kwargs
        model: Claude model identifier to use
        max_tokens: Maximum tokens in the response
        max_retries: Number of retry attempts on failure
        **kwargs: Values to format into the prompt_template

    Returns:
        Instance of response_type if successful, None otherwise
    """
    anthropic_client = Anthropic()
    formatted_prompt = prompt_template.format(**kwargs)

    tools = [
        {
            "name": "build_response_result",
            "description": "Build the structured response object.",
            "input_schema": response_type.model_json_schema(),
        }
    ]

    tries = 0
    while tries < max_retries:
        try:
            response = anthropic_client.messages.create(
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": formatted_prompt}],
                tools=cast(Any, tools),
                tool_choice=cast(Any, {"type": "tool", "name": "build_response_result"}),
            )

            function_call = response.content[0].input  # type: ignore[union-attr]
            parsed_response = response_type(**cast(dict[str, Any], function_call))
            return parsed_response

        except Exception as e:
            tries += 1
            if tries >= max_retries:
                print(f"Failed after {max_retries} attempts: {e}")
                return None
            time.sleep(0.5 * tries)

    return None
