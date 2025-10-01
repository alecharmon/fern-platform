import asyncio
import time
from typing import (
    Any,
    TypeVar,
)

from anthropic import (
    Anthropic,
    AsyncAnthropic,
)
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def generate_anthropic_generic(
    response_type: type[T],
    prompt_template: str,
    **kwargs: Any,
) -> T | None:
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
    while tries < 3:
        try:
            response = anthropic_client.messages.create(
                model="claude-opus-4-20250514",
                max_tokens=1000,
                messages=[{"role": "user", "content": formatted_prompt}],
                tools=tools,  # type: ignore
                tool_choice={"type": "tool", "name": "build_response_result"},  # type: ignore
            )

            function_call = response.content[0].input
            parsed_response = response_type(**function_call)
            return parsed_response

        except Exception:
            time.sleep(0.5)
            tries += 1
    return None


async def generate_anthropic_generic_async(
    response_type: type[T],
    prompt_template: str,
    **kwargs: Any,
) -> T | None:
    async with AsyncAnthropic() as anthropic_client:
        formatted_prompt = prompt_template.format(**kwargs)
        tools = [
            {
                "name": "build_response_result",
                "description": "Build the structured response object.",
                "input_schema": response_type.model_json_schema(),
            }
        ]
        tries = 0
        while tries < 3:
            try:
                response = await anthropic_client.messages.create(
                    model="claude-opus-4-20250514",
                    max_tokens=1000,
                    messages=[{"role": "user", "content": formatted_prompt}],
                    tools=tools,  # type: ignore
                    tool_choice={"type": "tool", "name": "build_response_result"},  # type: ignore
                )

                function_call = response.content[0].input
                parsed_response = response_type(**function_call)
                return parsed_response

            except Exception:
                await asyncio.sleep(0.5)
                tries += 1
        return None
