from collections.abc import AsyncGenerator
from unittest.mock import (
    AsyncMock,
    MagicMock,
)

import pytest

from fai_ai_core.llm.anthropic import AnthropicProvider
from fai_ai_core.llm.bedrock import BedrockProvider
from fai_ai_core.llm.cohere import CohereProvider
from fai_ai_core.llm.fallback import FallbackProvider
from fai_ai_core.llm.models import (
    LLMMessage,
    MessageRole,
    StreamEvent,
    StreamEventType,
)


class TestAnthropicProvider:
    def test_provider_properties(self) -> None:
        provider = AnthropicProvider(
            model_id="claude-test",
            api_key="test-key",
        )
        assert provider.model_id == "claude-test"
        assert provider.provider_name == "anthropic"

    def test_extract_system_messages(self) -> None:
        provider = AnthropicProvider(model_id="claude-test", api_key="test-key")

        messages = [
            LLMMessage(role=MessageRole.SYSTEM, content="You are helpful"),
            LLMMessage(role=MessageRole.USER, content="Hello"),
            LLMMessage(role=MessageRole.ASSISTANT, content="Hi there"),
            LLMMessage(role=MessageRole.SYSTEM, content="Be concise"),
        ]

        system_prompt, user_messages = provider._extract_system_and_messages(messages)

        assert system_prompt == "You are helpful\n\nBe concise"
        assert len(user_messages) == 2
        assert user_messages[0]["role"] == "user"
        assert user_messages[1]["role"] == "assistant"

    def test_extract_no_system_messages(self) -> None:
        provider = AnthropicProvider(model_id="claude-test", api_key="test-key")

        messages = [
            LLMMessage(role=MessageRole.USER, content="Hello"),
        ]

        system_prompt, user_messages = provider._extract_system_and_messages(messages)

        assert system_prompt is None
        assert len(user_messages) == 1


class TestBedrockProvider:
    def test_provider_properties(self) -> None:
        provider = BedrockProvider(
            model_id="test-model",
            region="us-east-1",
        )
        assert provider.model_id == "test-model"
        assert provider.provider_name == "bedrock"

    def test_extract_system_messages(self) -> None:
        provider = BedrockProvider(model_id="test-model")

        messages = [
            LLMMessage(role=MessageRole.SYSTEM, content="System prompt"),
            LLMMessage(role=MessageRole.USER, content="Hello"),
        ]

        system_blocks, bedrock_messages = provider._extract_system_and_messages(messages)

        assert system_blocks is not None
        assert len(system_blocks) == 1
        assert system_blocks[0]["text"] == "System prompt"
        assert len(bedrock_messages) == 1
        assert bedrock_messages[0]["role"] == "user"

    def test_get_session_without_credentials(self) -> None:
        provider = BedrockProvider(model_id="test-model", region="us-west-2")
        session = provider._get_session()
        assert session is not None

    def test_get_session_with_credentials(self) -> None:
        provider = BedrockProvider(
            model_id="test-model",
            region="us-west-2",
            aws_access_key_id="test-key",
            aws_secret_access_key="test-secret",
        )
        session = provider._get_session()
        assert session is not None


class TestCohereProvider:
    def test_provider_properties(self) -> None:
        provider = CohereProvider(
            model_id="command-a-03-2025",
            api_key="test-key",
        )
        assert provider.model_id == "command-a-03-2025"
        assert provider.provider_name == "cohere"

    def test_format_messages_with_system_and_history(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test-key")

        messages = [
            LLMMessage(role=MessageRole.SYSTEM, content="You are helpful"),
            LLMMessage(role=MessageRole.USER, content="What is 2+2?"),
            LLMMessage(role=MessageRole.ASSISTANT, content="4"),
            LLMMessage(role=MessageRole.SYSTEM, content="Be concise"),
            LLMMessage(role=MessageRole.USER, content="What is 3+3?"),
        ]

        formatted = provider._format_messages(messages)

        assert len(formatted) == 5
        assert formatted[0].role == "system"
        assert formatted[2].role == "assistant"
        assert formatted[-1].role == "user"

    def test_format_messages_single_user_message(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test-key")

        messages = [
            LLMMessage(role=MessageRole.USER, content="Hello"),
        ]

        formatted = provider._format_messages(messages)

        assert len(formatted) == 1
        assert formatted[0].role == "user"
        assert formatted[0].content == "Hello"

    def test_format_messages_with_system_no_history(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test-key")

        messages = [
            LLMMessage(role=MessageRole.SYSTEM, content="System prompt"),
            LLMMessage(role=MessageRole.USER, content="Question"),
        ]

        formatted = provider._format_messages(messages)

        assert formatted[0].role == "system"
        assert formatted[1].role == "user"
        assert formatted[1].content == "Question"

    def test_format_messages_role_mapping(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test-key")

        messages = [
            LLMMessage(role=MessageRole.ASSISTANT, content="Hi"),
            LLMMessage(role=MessageRole.USER, content="Hello"),
        ]

        formatted = provider._format_messages(messages)

        assert formatted[0].role == "assistant"
        assert formatted[1].role == "user"

    def test_format_messages_raises_on_system_in_history(self) -> None:
        provider = CohereProvider(model_id="command-a-03-2025", api_key="test-key")

        messages = [
            LLMMessage(role=MessageRole.SYSTEM, content="First system"),
        ]

        formatted = provider._format_messages(messages)
        assert len(formatted) == 1
        assert formatted[0].role == "system"


class TestFallbackProvider:
    def test_requires_at_least_one_provider(self) -> None:
        with pytest.raises(ValueError, match="requires at least one provider"):
            FallbackProvider([])

    def test_provider_properties(self) -> None:
        mock_provider = MagicMock()
        mock_provider.model_id = "test-model"
        mock_provider.provider_name = "test"

        fallback = FallbackProvider([mock_provider])
        assert fallback.model_id == "test-model"
        assert fallback.provider_name == "test"

    @pytest.mark.asyncio
    async def test_generate_tries_providers_in_order(self) -> None:
        provider1 = MagicMock()
        provider1.generate = AsyncMock(side_effect=Exception("Provider 1 failed"))
        provider1.provider_name = "provider1"
        provider1.model_id = "model1"

        provider2 = MagicMock()
        provider2.generate = AsyncMock(return_value="success")
        provider2.provider_name = "provider2"
        provider2.model_id = "model2"

        fallback = FallbackProvider([provider1, provider2])

        messages = [LLMMessage(role=MessageRole.USER, content="test")]
        result = await fallback.generate(messages)

        provider1.generate.assert_called_once()
        provider2.generate.assert_called_once()
        assert result == "success"

    @pytest.mark.asyncio
    async def test_generate_raises_when_all_fail(self) -> None:
        provider1 = MagicMock()
        provider1.generate = AsyncMock(side_effect=Exception("Failed"))
        provider1.provider_name = "provider1"
        provider1.model_id = "model1"

        fallback = FallbackProvider([provider1])

        messages = [LLMMessage(role=MessageRole.USER, content="test")]

        with pytest.raises(RuntimeError, match="All .* providers failed"):
            await fallback.generate(messages)

    @pytest.mark.asyncio
    async def test_generate_stream_falls_back_when_provider_fails_before_streaming(self) -> None:
        async def failing_stream() -> AsyncGenerator[StreamEvent, None]:
            raise Exception("Provider 1 failed before streaming")
            yield

        async def successful_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        provider1 = MagicMock()
        provider1.generate_stream = MagicMock(return_value=failing_stream())
        provider1.provider_name = "provider1"
        provider1.model_id = "model1"

        provider2 = MagicMock()
        provider2.generate_stream = MagicMock(return_value=successful_stream())
        provider2.provider_name = "provider2"
        provider2.model_id = "model2"

        fallback = FallbackProvider([provider1, provider2])

        messages = [LLMMessage(role=MessageRole.USER, content="test")]
        events = []
        async for event in fallback.generate_stream(messages):
            events.append(event)

        assert len(events) == 2
        assert events[0].data == "Hello"
        assert events[1].type == StreamEventType.DONE

    @pytest.mark.asyncio
    async def test_generate_stream_does_not_fallback_after_streaming_starts(self) -> None:
        async def partially_successful_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Partial")
            raise Exception("Provider failed mid-stream")

        async def backup_stream() -> AsyncGenerator[StreamEvent, None]:
            yield StreamEvent(type=StreamEventType.TEXT_DELTA, data="Backup")
            yield StreamEvent(type=StreamEventType.DONE, data="")

        provider1 = MagicMock()
        provider1.generate_stream = MagicMock(return_value=partially_successful_stream())
        provider1.provider_name = "provider1"
        provider1.model_id = "model1"

        provider2 = MagicMock()
        provider2.generate_stream = MagicMock(return_value=backup_stream())
        provider2.provider_name = "provider2"
        provider2.model_id = "model2"

        fallback = FallbackProvider([provider1, provider2])

        messages = [LLMMessage(role=MessageRole.USER, content="test")]

        events = []
        with pytest.raises(
            RuntimeError, match="Stream failed mid-response from provider1.*Partial content was already sent"
        ):
            async for event in fallback.generate_stream(messages):
                events.append(event)

        assert len(events) == 1
        assert events[0].data == "Partial"
        provider2.generate_stream.assert_not_called()
