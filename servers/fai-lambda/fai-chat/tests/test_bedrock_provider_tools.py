from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest

from src.llm.bedrock import BedrockProvider
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


class TestBedrockProviderTools:
    def test_tool_definition_formatted_for_bedrock(self) -> None:
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

        result = tool_def.to_bedrock_format()

        assert "toolSpec" in result
        assert result["toolSpec"]["name"] == "documentationSearch"
        assert result["toolSpec"]["description"] == "Search the knowledge base"
        assert "inputSchema" in result["toolSpec"]
        assert "json" in result["toolSpec"]["inputSchema"]
        assert result["toolSpec"]["inputSchema"]["json"]["type"] == "object"
        assert "query" in result["toolSpec"]["inputSchema"]["json"]["properties"]
        assert result["toolSpec"]["inputSchema"]["json"]["required"] == ["query"]

    @pytest.mark.asyncio
    async def test_handle_tool_use_success(self) -> None:
        provider = BedrockProvider(model_id="anthropic.claude-4-sonnet-v2:0", region="us-east-1")

        execution_args = None

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            nonlocal execution_args
            execution_args = args
            return [{"result": "success", "items": ["a", "b"]}]

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=2)
        tool_map = {"testTool": tool}

        mock_tool_use = {
            "toolUseId": "bedrock_tool_123",
            "name": "testTool",
            "input": {"query": "bedrock query"},
        }

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert start_event.type == StreamEventType.TOOL_CALL_START
        assert isinstance(start_event.data, dict)
        assert start_event.data["id"] == "bedrock_tool_123"
        assert start_event.data["name"] == "testTool"

        assert result_event.type == StreamEventType.TOOL_CALL_RESULT
        assert isinstance(result_event.data, dict)
        assert result_event.data["id"] == "bedrock_tool_123"
        assert result_event.data["output"] == [{"result": "success", "items": ["a", "b"]}]

        assert tool_result["toolUseId"] == "bedrock_tool_123"
        assert "content" in tool_result
        assert len(tool_result["content"]) == 1
        assert "json" in tool_result["content"][0]
        assert tool_result["content"][0]["json"] == {"results": [{"result": "success", "items": ["a", "b"]}]}

        assert execution_args == {"query": "bedrock query"}

    @pytest.mark.asyncio
    async def test_handle_tool_use_enforces_max_calls(self) -> None:
        provider = BedrockProvider(model_id="anthropic.claude-4-sonnet-v2:0", region="us-east-1")

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            return [{"data": "result"}]

        tool_def = ToolDefinition(name="limitedTool", description="Limited")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=1)

        await tool.execute_with_limit({})

        tool_map = {"limitedTool": tool}

        mock_tool_use = {
            "toolUseId": "tool_limited",
            "name": "limitedTool",
            "input": {},
        }

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert result_event.type == StreamEventType.TOOL_CALL_RESULT
        assert isinstance(result_event.data, dict)
        assert result_event.data["output"] == []

    @pytest.mark.asyncio
    async def test_handle_tool_use_unknown_tool(self) -> None:
        provider = BedrockProvider(model_id="anthropic.claude-4-sonnet-v2:0", region="us-east-1")

        tool_map: dict[str, Tool] = {}

        mock_tool_use = {
            "toolUseId": "tool_unknown",
            "name": "unknownTool",
            "input": {},
        }

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert start_event.type == StreamEventType.TOOL_CALL_START
        assert result_event.type == StreamEventType.ERROR
        assert isinstance(result_event.data, dict)
        assert "Unknown tool" in result_event.data["error"]
        assert tool_result["status"] == "error"

    @pytest.mark.asyncio
    async def test_handle_tool_use_execution_error(self) -> None:
        provider = BedrockProvider(model_id="anthropic.claude-4-sonnet-v2:0", region="us-east-1")

        async def failing_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            raise RuntimeError("Tool crashed")

        tool_def = ToolDefinition(name="crashingTool", description="Crashes")
        tool = Tool(definition=tool_def, execute=failing_execute)
        tool_map = {"crashingTool": tool}

        mock_tool_use = {
            "toolUseId": "tool_crash",
            "name": "crashingTool",
            "input": {},
        }

        start_event, result_event, tool_result = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert result_event.type == StreamEventType.ERROR
        assert isinstance(result_event.data, dict)
        assert "Tool execution error" in result_event.data["error"]
        assert "Tool crashed" in result_event.data["error"]
        assert tool_result["status"] == "error"

    @pytest.mark.asyncio
    async def test_generate_with_tools_non_stream(self) -> None:
        provider = BedrockProvider(model_id="anthropic.claude-4-sonnet-v2:0", region="us-east-1")

        executed_args = None

        async def run_tool(args: dict[str, Any]) -> dict[str, Any]:
            nonlocal executed_args
            executed_args = args
            return {"result": "ok"}

        tool_def = ToolDefinition(name="docSearch", description="test")
        tool = Tool(definition=tool_def, execute=run_tool)

        first_response = {
            "output": {
                "message": {
                    "content": [{"toolUse": {"toolUseId": "call1", "name": "docSearch", "input": {"query": "hi"}}}]
                }
            },
            "usage": {"inputTokens": 2, "outputTokens": 1},
            "stopReason": "tool_use",
        }
        second_response = {
            "output": {"message": {"content": [{"text": "done"}]}},
            "usage": {"inputTokens": 1, "outputTokens": 2},
            "stopReason": "end",
        }

        responses: Iterator[dict[str, Any]] = iter([first_response, second_response])

        class FakeClient:
            async def __aenter__(self) -> "FakeClient":
                return self

            async def __aexit__(self, *args: Any) -> None:
                return None

            async def converse(self, **_: Any) -> dict[str, Any]:
                return next(responses)

        class FakeSession:
            def client(self, *_: Any, **__: Any) -> FakeClient:
                return FakeClient()

        provider._get_session = MagicMock(return_value=FakeSession())  # type: ignore[method-assign]

        result = await provider.generate(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            tools=[tool],
        )

        assert executed_args == {"query": "hi"}
        assert result.content == "done"
        assert result.metrics.input_tokens == 3
        assert result.metrics.output_tokens == 3
        assert result.finish_reason == "end"
