from typing import Any

import pytest

from fai_ai_core.tools.models import (
    Tool,
    ToolDefinition,
    ToolParameter,
)


class TestToolParameter:
    def test_create_simple_parameter(self) -> None:
        param = ToolParameter(
            name="query",
            type="string",
            description="Search query",
            required=True,
        )
        assert param.name == "query"
        assert param.type == "string"
        assert param.description == "Search query"
        assert param.required is True
        assert param.properties is None
        assert param.items is None

    def test_create_optional_parameter(self) -> None:
        param = ToolParameter(
            name="limit",
            type="number",
            description="Max results",
            required=False,
        )
        assert param.required is False

    def test_default_required_is_true(self) -> None:
        param = ToolParameter(
            name="text",
            type="string",
            description="Text input",
        )
        assert param.required is True


class TestToolDefinition:
    def test_create_tool_definition(self) -> None:
        tool_def = ToolDefinition(
            name="testTool",
            description="A test tool",
            parameters=[
                ToolParameter(
                    name="query",
                    type="string",
                    description="The query",
                    required=True,
                )
            ],
        )
        assert tool_def.name == "testTool"
        assert tool_def.description == "A test tool"
        assert len(tool_def.parameters) == 1
        assert tool_def.parameters[0].name == "query"

    def test_create_tool_definition_no_parameters(self) -> None:
        tool_def = ToolDefinition(
            name="noParamTool",
            description="No params",
        )
        assert tool_def.name == "noParamTool"
        assert tool_def.parameters == []

    def test_to_anthropic_format_simple(self) -> None:
        tool_def = ToolDefinition(
            name="search",
            description="Search docs",
            parameters=[
                ToolParameter(
                    name="query",
                    type="string",
                    description="Search query",
                    required=True,
                )
            ],
        )
        result = tool_def.to_anthropic_format()

        assert result["name"] == "search"
        assert result["description"] == "Search docs"
        assert "input_schema" in result
        assert result["input_schema"]["type"] == "object"
        assert "query" in result["input_schema"]["properties"]
        assert result["input_schema"]["properties"]["query"]["type"] == "string"
        assert result["input_schema"]["required"] == ["query"]

    def test_to_anthropic_format_optional_param(self) -> None:
        tool_def = ToolDefinition(
            name="search",
            description="Search",
            parameters=[
                ToolParameter(name="query", type="string", description="Query", required=True),
                ToolParameter(name="limit", type="number", description="Limit", required=False),
            ],
        )
        result = tool_def.to_anthropic_format()

        assert result["input_schema"]["required"] == ["query"]
        assert "limit" in result["input_schema"]["properties"]
        assert "query" in result["input_schema"]["properties"]

    def test_to_bedrock_format_simple(self) -> None:
        tool_def = ToolDefinition(
            name="search",
            description="Search docs",
            parameters=[
                ToolParameter(
                    name="query",
                    type="string",
                    description="Search query",
                    required=True,
                )
            ],
        )
        result = tool_def.to_bedrock_format()

        assert "toolSpec" in result
        assert result["toolSpec"]["name"] == "search"
        assert result["toolSpec"]["description"] == "Search docs"
        assert "inputSchema" in result["toolSpec"]
        assert "json" in result["toolSpec"]["inputSchema"]
        assert result["toolSpec"]["inputSchema"]["json"]["type"] == "object"
        assert "query" in result["toolSpec"]["inputSchema"]["json"]["properties"]


class TestTool:
    @pytest.mark.asyncio
    async def test_create_tool(self) -> None:
        async def mock_execute(args: dict[str, Any]) -> str:
            return "result"

        tool_def = ToolDefinition(
            name="test",
            description="Test",
            parameters=[],
        )
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=5)

        assert tool.definition == tool_def
        assert tool.max_calls == 5
        assert tool._call_count == 0

    @pytest.mark.asyncio
    async def test_tool_execute_with_limit(self) -> None:
        call_count = 0

        async def mock_execute(args: dict[str, Any]) -> str:
            nonlocal call_count
            call_count += 1
            return f"result_{call_count}"

        tool_def = ToolDefinition(name="test", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=2)

        result1 = await tool.execute_with_limit({})
        assert result1 == "result_1"
        assert tool._call_count == 1

        result2 = await tool.execute_with_limit({})
        assert result2 == "result_2"
        assert tool._call_count == 2

        result3 = await tool.execute_with_limit({})
        assert result3 == []
        assert tool._call_count == 2

    @pytest.mark.asyncio
    async def test_can_execute(self) -> None:
        async def mock_execute(args: dict[str, Any]) -> str:
            return "result"

        tool_def = ToolDefinition(name="test", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=1)

        assert tool.can_execute() is True
        await tool.execute_with_limit({})
        assert tool.can_execute() is False

    @pytest.mark.asyncio
    async def test_reset_call_count(self) -> None:
        async def mock_execute(args: dict[str, Any]) -> str:
            return "result"

        tool_def = ToolDefinition(name="test", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=1)

        await tool.execute_with_limit({})
        assert tool.can_execute() is False

        tool.reset_call_count()
        assert tool.can_execute() is True
        assert tool._call_count == 0

    @pytest.mark.asyncio
    async def test_default_max_calls(self) -> None:
        async def mock_execute(args: dict[str, Any]) -> str:
            return "result"

        tool_def = ToolDefinition(name="test", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute)

        assert tool.max_calls == 5
