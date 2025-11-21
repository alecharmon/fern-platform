from types import SimpleNamespace
from typing import Any
from unittest.mock import (
    AsyncMock,
    MagicMock,
)

import pytest
from cohere.types import (
    ToolCallV2,
    ToolCallV2Function,
)

from src.llm.cohere import CohereProvider
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


class TestCohereProviderTools:
    def test_provider_properties(self) -> None:
        provider = CohereProvider(
            model_id="command-a-03-2025",
            api_key="test_key",
        )

        assert provider.model_id == "command-a-03-2025"
        assert provider.provider_name == "cohere"

    def test_tool_definition_formatted_for_cohere_v2(self) -> None:
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
            ],
        )

        result = tool_def.to_cohere_v2_format()

        assert result.function is not None
        assert result.function.name == "documentationSearch"
        assert result.function.description == "Search the knowledge base"
        assert result.function.parameters is not None
        assert result.function.parameters["properties"]["query"]["type"] == "string"
        assert "query" in result.function.parameters["required"]

    @pytest.mark.asyncio
    async def test_handle_tool_call_success(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test_key")

        execution_args = None

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            nonlocal execution_args
            execution_args = args
            return [{"result": "cohere_success"}]

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=2)
        tool_map = {"testTool": tool}

        mock_tool_call = MagicMock()
        mock_tool_call.id = "cohere_tool_123"
        mock_tool_call.function = MagicMock()
        mock_tool_call.function.name = "testTool"
        mock_tool_call.function.arguments = '{"query": "cohere query"}'

        start_event, result_event, tool_result = await provider._handle_tool_call(mock_tool_call, tool_map)

        assert start_event.type == StreamEventType.TOOL_CALL_START
        assert isinstance(start_event.data, dict)
        assert start_event.data["id"] == "cohere_tool_123"
        assert start_event.data["name"] == "testTool"

        assert result_event.type == StreamEventType.TOOL_CALL_RESULT
        assert isinstance(result_event.data, dict)
        assert result_event.data["output"] == [{"result": "cohere_success"}]

        assert tool_result.role == "tool"
        assert tool_result.tool_call_id == "cohere_tool_123"
        assert tool_result.content is not None
        assert tool_result.content[0].type == "document"
        assert tool_result.content[0].document.data == {"result": "cohere_success"}

        assert execution_args == {"query": "cohere query"}

    @pytest.mark.asyncio
    async def test_handle_tool_call_invalid_json(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test_key")

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            return []

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute)
        tool_map = {"testTool": tool}

        mock_tool_call = MagicMock()
        mock_tool_call.id = "tool_invalid"
        mock_tool_call.function = MagicMock()
        mock_tool_call.function.name = "testTool"
        mock_tool_call.function.arguments = "invalid json {{"

        start_event, result_event, tool_result = await provider._handle_tool_call(mock_tool_call, tool_map)

        assert start_event.type == StreamEventType.TOOL_CALL_START
        assert result_event.type == StreamEventType.TOOL_CALL_RESULT
        assert tool_result.tool_call_id == "tool_invalid"
        assert isinstance(tool_result.content, list)

    @pytest.mark.asyncio
    async def test_generate_with_tools_non_stream(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test_key")

        tool_calls = [
            ToolCallV2(
                id="call1",
                type="function",
                function=ToolCallV2Function(name="testTool", arguments='{"query": "q1"}'),
            )
        ]

        first_response = SimpleNamespace(
            message=SimpleNamespace(content=None, tool_calls=tool_calls),
            usage=SimpleNamespace(tokens=SimpleNamespace(input_tokens=3, output_tokens=4)),
            finish_reason="TOOL_CALL",
        )
        second_response = SimpleNamespace(
            message=SimpleNamespace(
                content=[SimpleNamespace(type="text", text="final answer")],
                tool_calls=None,
            ),
            usage=SimpleNamespace(tokens=SimpleNamespace(input_tokens=1, output_tokens=2)),
            finish_reason="COMPLETE",
        )

        provider._client.chat = AsyncMock(side_effect=[first_response, second_response])

        executed_args = None

        async def run_tool(args: dict[str, Any]) -> dict[str, Any]:
            nonlocal executed_args
            executed_args = args
            return {"result": "ok"}

        tool_def = ToolDefinition(name="testTool", description="testing")
        tool = Tool(definition=tool_def, execute=run_tool)

        result = await provider.generate(
            messages=[LLMMessage(role=MessageRole.USER, content="Hi")],
            tools=[tool],
        )

        assert provider._client.chat.await_count == 2
        assert executed_args == {"query": "q1"}
        assert result.content == "final answer"
        assert result.metrics.input_tokens == 4
        assert result.metrics.output_tokens == 6

    @pytest.mark.asyncio
    async def test_handle_tool_call_missing_id_raises(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test_key")

        mock_tool_call = MagicMock()
        mock_tool_call.id = None
        mock_tool_call.function = MagicMock()
        mock_tool_call.function.name = "testTool"
        mock_tool_call.function.arguments = "{}"

        with pytest.raises(ValueError, match="missing id"):
            await provider._handle_tool_call(mock_tool_call, {})
