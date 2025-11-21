from collections.abc import (
    Awaitable,
    Callable,
)
from typing import Any

from cohere.types.tool_v2 import (
    ToolV2,
    ToolV2Function,
)
from pydantic import (
    BaseModel,
    Field,
)


class ToolParameter(BaseModel):
    name: str = Field(..., description="Parameter name")
    type: str = Field(..., description="Parameter type (string, number, boolean, object, array)")
    description: str = Field(..., description="Description of what this parameter does")
    required: bool = Field(default=True, description="Whether this parameter is required")
    properties: dict[str, "ToolParameter"] | None = Field(
        default=None, description="Nested properties for object types"
    )
    items: "ToolParameter | None" = Field(default=None, description="Item type for array types")


class ToolDefinition(BaseModel):
    name: str = Field(..., description="Unique tool identifier")
    description: str = Field(..., description="What this tool does")
    parameters: list[ToolParameter] = Field(default_factory=list, description="Tool parameters")

    def to_anthropic_format(self) -> dict[str, Any]:
        input_schema: dict[str, Any] = {
            "type": "object",
            "properties": {},
            "required": [],
        }

        for param in self.parameters:
            param_schema: dict[str, Any] = {
                "type": param.type,
                "description": param.description,
            }

            if param.properties:
                param_schema["properties"] = {
                    name: {
                        "type": prop.type,
                        "description": prop.description,
                    }
                    for name, prop in param.properties.items()
                }

            if param.items:
                param_schema["items"] = {
                    "type": param.items.type,
                    "description": param.items.description,
                }

            input_schema["properties"][param.name] = param_schema

            if param.required:
                input_schema["required"].append(param.name)

        return {"name": self.name, "description": self.description, "input_schema": input_schema}

    def to_bedrock_format(self) -> dict[str, Any]:
        input_schema: dict[str, Any] = {
            "json": {
                "type": "object",
                "properties": {},
                "required": [],
            }
        }

        for param in self.parameters:
            param_schema: dict[str, Any] = {
                "type": param.type,
                "description": param.description,
            }

            if param.properties:
                param_schema["properties"] = {
                    name: {
                        "type": prop.type,
                        "description": prop.description,
                    }
                    for name, prop in param.properties.items()
                }

            if param.items:
                param_schema["items"] = {
                    "type": param.items.type,
                    "description": param.items.description,
                }

            input_schema["json"]["properties"][param.name] = param_schema

            if param.required:
                input_schema["json"]["required"].append(param.name)

        return {"toolSpec": {"name": self.name, "description": self.description, "inputSchema": input_schema}}

    def to_cohere_v2_format(self) -> ToolV2:
        properties: dict[str, Any] = {}
        required: list[str] = []

        for param in self.parameters:
            param_schema: dict[str, Any] = {
                "type": param.type,
                "description": param.description,
            }

            if param.properties:
                param_schema["properties"] = {
                    name: {
                        "type": prop.type,
                        "description": prop.description,
                    }
                    for name, prop in param.properties.items()
                }

            if param.items:
                param_schema["items"] = {
                    "type": param.items.type,
                    "description": param.items.description,
                }

            properties[param.name] = param_schema

            if param.required:
                required.append(param.name)

        parameters = {
            "type": "object",
            "properties": properties,
            "required": required,
        }

        return ToolV2(
            type="function",
            function=ToolV2Function(
                name=self.name,
                description=self.description,
                parameters=parameters,
            ),
        )


class Tool(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    definition: ToolDefinition = Field(..., description="Tool definition with metadata")
    execute: Callable[[dict[str, Any]], Awaitable[Any]] = Field(
        ..., description="Async function that executes the tool"
    )
    max_calls: int = Field(default=5, description="Maximum number of times this tool can be called")
    _call_count: int = 0

    def can_execute(self) -> bool:
        return self._call_count < self.max_calls

    def increment_call_count(self) -> None:
        self._call_count += 1

    def reset_call_count(self) -> None:
        self._call_count = 0

    async def execute_with_limit(self, arguments: dict[str, Any]) -> Any:
        if not self.can_execute():
            return []
        self.increment_call_count()
        return await self.execute(arguments)
