from typing import Any

import pytest

from fai_ai_core.tools.models import (
    Tool,
    ToolDefinition,
)
from fai_ai_core.tools.registry import ToolRegistry


class TestToolRegistry:
    @pytest.mark.asyncio
    async def test_register_and_get_tool(self) -> None:
        async def mock_execute(args: dict[str, Any]) -> str:
            return "result"

        registry = ToolRegistry()
        tool_def = ToolDefinition(name="testTool", description="Test tool")
        tool = Tool(definition=tool_def, execute=mock_execute)

        registry.register(tool)
        retrieved = registry.get("testTool")

        assert retrieved is not None
        assert retrieved.definition.name == "testTool"

    def test_get_nonexistent_tool(self) -> None:
        registry = ToolRegistry()
        result = registry.get("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_all_tools(self) -> None:
        async def mock_execute(args: dict[str, Any]) -> str:
            return "result"

        registry = ToolRegistry()

        tool1_def = ToolDefinition(name="tool1", description="Tool 1")
        tool1 = Tool(definition=tool1_def, execute=mock_execute)

        tool2_def = ToolDefinition(name="tool2", description="Tool 2")
        tool2 = Tool(definition=tool2_def, execute=mock_execute)

        registry.register(tool1)
        registry.register(tool2)

        all_tools = registry.get_all()
        assert len(all_tools) == 2
        tool_names = {t.definition.name for t in all_tools}
        assert tool_names == {"tool1", "tool2"}

    @pytest.mark.asyncio
    async def test_clear_registry(self) -> None:
        async def mock_execute(args: dict[str, Any]) -> str:
            return "result"

        registry = ToolRegistry()
        tool_def = ToolDefinition(name="testTool", description="Test")
        tool = Tool(definition=tool_def, execute=mock_execute)

        registry.register(tool)
        assert len(registry.get_all()) == 1

        registry.clear()
        assert len(registry.get_all()) == 0
        assert registry.get("testTool") is None

    @pytest.mark.asyncio
    async def test_register_overwrites_existing(self) -> None:
        async def mock_execute_v1(args: dict[str, Any]) -> str:
            return "v1"

        async def mock_execute_v2(args: dict[str, Any]) -> str:
            return "v2"

        registry = ToolRegistry()

        tool_v1_def = ToolDefinition(name="testTool", description="Version 1")
        tool_v1 = Tool(definition=tool_v1_def, execute=mock_execute_v1)

        tool_v2_def = ToolDefinition(name="testTool", description="Version 2")
        tool_v2 = Tool(definition=tool_v2_def, execute=mock_execute_v2)

        registry.register(tool_v1)
        registry.register(tool_v2)

        retrieved = registry.get("testTool")
        assert retrieved is not None
        assert retrieved.definition.description == "Version 2"
        result = await retrieved.execute({})
        assert result == "v2"
