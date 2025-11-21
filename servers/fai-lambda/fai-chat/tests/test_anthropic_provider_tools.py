from types import SimpleNamespace
from typing import Any
from unittest.mock import (
    AsyncMock,
    MagicMock,
)

import pytest

from src.llm.anthropic import AnthropicProvider
from src.llm.models import (
    LLMMessage,
    MessageRole,
    StreamEventType,
)
from src.tools.models import (
    Tool,
    ToolDefinition,
    ToolParameter,
)


class TestAnthropicProviderTools:
    def test_tool_definition_formatted_for_anthropic(self) -> None:
        tool_def = ToolDefinition(
            name="documentationSearch",
            description="Search the knowledge base",
            parameters=[
                ToolParameter(
                    name="query",
                    type="string",
                    description="Search query",
                    required=True,
                ),
                ToolParameter(
                    name="limit",
                    type="number",
                    description="Max results",
                    required=False,
                ),
            ],
        )

        result = tool_def.to_anthropic_format()

        assert result["name"] == "documentationSearch"
        assert result["description"] == "Search the knowledge base"
        assert "input_schema" in result
        assert result["input_schema"]["type"] == "object"
        assert "query" in result["input_schema"]["properties"]
        assert "limit" in result["input_schema"]["properties"]
        assert result["input_schema"]["required"] == ["query"]
        assert result["input_schema"]["properties"]["query"]["type"] == "string"
        assert result["input_schema"]["properties"]["limit"]["type"] == "number"

    @pytest.mark.asyncio
    async def test_handle_tool_use_success(self) -> None:
        provider = AnthropicProvider(model_id="claude-4-sonnet", api_key="test_key")

        execution_args = None

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            nonlocal execution_args
            execution_args = args
            return [{"result": "success", "count": 5}]

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=2)
        tool_map = {"testTool": tool}

        mock_tool_use = MagicMock()
        mock_tool_use.id = "tool_abc123"
        mock_tool_use.name = "testTool"
        mock_tool_use.input = {"query": "test query", "limit": 10}

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert start_event.type == StreamEventType.TOOL_CALL_START
        assert isinstance(start_event.data, dict)
        assert start_event.data["id"] == "tool_abc123"
        assert start_event.data["name"] == "testTool"

        assert result_event.type == StreamEventType.TOOL_CALL_RESULT
        assert isinstance(result_event.data, dict)
        assert result_event.data["id"] == "tool_abc123"
        assert result_event.data["name"] == "testTool"
        assert result_event.data["input"] == {"query": "test query", "limit": 10}
        assert result_event.data["output"] == [{"result": "success", "count": 5}]

        assert tool_result["type"] == "tool_result"
        assert tool_result["tool_use_id"] == "tool_abc123"
        assert tool_result["content"] == '[{"result": "success", "count": 5}]'

        assert execution_args == {"query": "test query", "limit": 10}
        assert tool._call_count == 1

    @pytest.mark.asyncio
    async def test_handle_tool_use_enforces_max_calls(self) -> None:
        provider = AnthropicProvider(model_id="claude-4-sonnet", api_key="test_key")

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            return [{"result": "data"}]

        tool_def = ToolDefinition(name="limitedTool", description="Limited")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=1)

        await tool.execute_with_limit({})

        tool_map = {"limitedTool": tool}

        mock_tool_use = MagicMock()
        mock_tool_use.id = "tool_limit"
        mock_tool_use.name = "limitedTool"
        mock_tool_use.input = {}

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert result_event.type == StreamEventType.TOOL_CALL_RESULT
        assert isinstance(result_event.data, dict)
        assert result_event.data["output"] == []

    @pytest.mark.asyncio
    async def test_handle_tool_use_unknown_tool(self) -> None:
        provider = AnthropicProvider(model_id="claude-4-sonnet", api_key="test_key")

        tool_map: dict[str, Tool] = {}

        mock_tool_use = MagicMock()
        mock_tool_use.id = "tool_unknown"
        mock_tool_use.name = "unknownTool"
        mock_tool_use.input = {}

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert start_event.type == StreamEventType.TOOL_CALL_START
        assert result_event.type == StreamEventType.ERROR
        assert isinstance(result_event.data, dict)
        assert "Unknown tool" in result_event.data["error"]
        assert tool_result["is_error"] is True

    @pytest.mark.asyncio
    async def test_handle_tool_use_execution_error(self) -> None:
        provider = AnthropicProvider(model_id="claude-4-sonnet", api_key="test_key")

        async def failing_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            raise ValueError("Execution failed")

        tool_def = ToolDefinition(name="failingTool", description="Fails")
        tool = Tool(definition=tool_def, execute=failing_execute)
        tool_map = {"failingTool": tool}

        mock_tool_use = MagicMock()
        mock_tool_use.id = "tool_fail"
        mock_tool_use.name = "failingTool"
        mock_tool_use.input = {}

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert result_event.type == StreamEventType.ERROR
        assert isinstance(result_event.data, dict)
        assert "Tool execution error" in result_event.data["error"]
        assert "Execution failed" in result_event.data["error"]
        assert tool_result["is_error"] is True

    @pytest.mark.asyncio
    async def test_generate_with_tools_non_stream(self) -> None:
        provider = AnthropicProvider(model_id="claude-4-sonnet", api_key="test_key")

        executed_args = None

        async def run_tool(args: dict[str, Any]) -> dict[str, Any]:
            nonlocal executed_args
            executed_args = args
            return {"result": "ok"}

        tool_def = ToolDefinition(name="docSearch", description="test")
        tool = Tool(definition=tool_def, execute=run_tool)

        first_response = SimpleNamespace(
            content=[
                SimpleNamespace(type="tool_use", id="tool1", name="docSearch", input={"query": "hello"}),
            ],
            usage=SimpleNamespace(input_tokens=2, output_tokens=1),
            stop_reason="tool_use",
        )
        second_response = SimpleNamespace(
            content=[SimpleNamespace(type="text", text="final text")],
            usage=SimpleNamespace(input_tokens=1, output_tokens=2),
            stop_reason="end",
        )

        provider._client.messages.create = AsyncMock(side_effect=[first_response, second_response])

        result = await provider.generate(
            messages=[LLMMessage(role=MessageRole.USER, content="Hi")],
            tools=[tool],
        )

        assert provider._client.messages.create.await_count == 2
        assert executed_args == {"query": "hello"}
        assert result.content == "final text"
        assert result.metrics.input_tokens == 3
        assert result.metrics.output_tokens == 3
