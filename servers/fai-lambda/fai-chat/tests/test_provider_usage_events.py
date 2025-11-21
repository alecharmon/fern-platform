from typing import Any
from unittest.mock import MagicMock

import pytest

from src.llm.anthropic import AnthropicProvider
from src.llm.bedrock import BedrockProvider
from src.llm.cohere import CohereProvider
from src.llm.models import StreamEventType
from src.tools.models import (
    Tool,
    ToolDefinition,
)


class TestProviderUsageEvents:
    @pytest.mark.asyncio
    async def test_anthropic_emits_single_usage_event(self) -> None:
        provider = AnthropicProvider(model_id="claude-4-sonnet", api_key="test_key")

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            return []

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute, max_calls=1)
        tool_map = {"testTool": tool}

        mock_tool_use = MagicMock()
        mock_tool_use.id = "tool_1"
        mock_tool_use.name = "testTool"
        mock_tool_use.input = {}

        events = []
        start_event, result_event, _ = await provider._handle_tool_use(mock_tool_use, tool_map)
        events.extend([start_event, result_event])

        usage_events = [e for e in events if e.type == StreamEventType.USAGE]
        assert len(usage_events) == 0

    @pytest.mark.asyncio
    async def test_usage_event_contains_all_metrics(self) -> None:
        provider = AnthropicProvider(model_id="claude-4-sonnet", api_key="test_key")

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            return []

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute)
        tool_map = {"testTool": tool}

        mock_tool_use = MagicMock()
        mock_tool_use.id = "tool_1"
        mock_tool_use.name = "testTool"
        mock_tool_use.input = {}

        start_event, result_event, _ = await provider._handle_tool_use(mock_tool_use, tool_map)

        assert start_event.type == StreamEventType.TOOL_CALL_START
        assert result_event.type == StreamEventType.TOOL_CALL_RESULT

    @pytest.mark.asyncio
    async def test_bedrock_handle_tool_use_no_usage_event(self) -> None:
        provider = BedrockProvider(model_id="anthropic.claude-4-sonnet-v2:0", region="us-east-1")

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            return []

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute)
        tool_map = {"testTool": tool}

        mock_tool_use = {
            "toolUseId": "tool_1",
            "name": "testTool",
            "input": {},
        }

        events = []
        start_event, result_event, _ = await provider._handle_tool_use(mock_tool_use, tool_map)
        events.extend([start_event, result_event])

        usage_events = [e for e in events if e.type == StreamEventType.USAGE]
        assert len(usage_events) == 0

    @pytest.mark.asyncio
    async def test_cohere_handle_tool_call_no_usage_event(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test_key")

        async def mock_execute(args: dict[str, Any]) -> list[dict[str, Any]]:
            return []

        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute)
        tool_map = {"testTool": tool}

        mock_tool_call = MagicMock()
        mock_tool_call.id = "tool_1"
        mock_tool_call.function = MagicMock()
        mock_tool_call.function.name = "testTool"
        mock_tool_call.function.arguments = "{}"

        events = []
        start_event, result_event, _ = await provider._handle_tool_call(mock_tool_call, tool_map)
        events.extend([start_event, result_event])

        usage_events = [e for e in events if e.type == StreamEventType.USAGE]
        assert len(usage_events) == 0
