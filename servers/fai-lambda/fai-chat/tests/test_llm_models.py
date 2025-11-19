from src.llm.models import (
    LLMMessage,
    LLMMetrics,
    LLMResponse,
    MessageRole,
    StreamEvent,
    StreamEventType,
)


class TestLLMMessage:
    def test_create_user_message(self) -> None:
        msg = LLMMessage(role=MessageRole.USER, content="Hello")
        assert msg.role == MessageRole.USER
        assert msg.content == "Hello"

    def test_create_system_message(self) -> None:
        msg = LLMMessage(role=MessageRole.SYSTEM, content="You are helpful")
        assert msg.role == MessageRole.SYSTEM
        assert msg.content == "You are helpful"

    def test_to_dict(self) -> None:
        msg = LLMMessage(role=MessageRole.USER, content="Test")
        result = msg.to_dict()
        assert result == {"role": "user", "content": "Test"}

    def test_structured_content(self) -> None:
        content = [{"type": "text", "text": "Hello"}]
        msg = LLMMessage(role=MessageRole.USER, content=content)
        assert msg.content == content


class TestStreamEvent:
    def test_text_delta_to_sse(self) -> None:
        event = StreamEvent(type=StreamEventType.TEXT_DELTA, data="Hello")
        assert event.to_sse() == "data: Hello\n\n"

    def test_done_to_sse(self) -> None:
        event = StreamEvent(type=StreamEventType.DONE, data="")
        assert event.to_sse() == "data: [DONE]\n\n"

    def test_usage_to_sse(self) -> None:
        event = StreamEvent(
            type=StreamEventType.USAGE,
            data={"input_tokens": 10, "output_tokens": 20},
        )
        sse = event.to_sse()
        assert "data: " in sse
        assert '"type": "usage"' in sse
        assert '"input_tokens": 10' in sse
        assert '"output_tokens": 20' in sse
        assert sse.endswith("\n\n")

    def test_structured_event_to_sse(self) -> None:
        event = StreamEvent(
            type=StreamEventType.DATA_SOURCES,
            data=[{"title": "Doc 1", "url": "http://example.com"}],
        )
        sse = event.to_sse()
        assert "data: " in sse
        assert '"type": "data-sources"' in sse


class TestLLMMetrics:
    def test_create_metrics(self) -> None:
        metrics = LLMMetrics(
            total_time_ms=150.5,
            input_tokens=10,
            output_tokens=20,
        )
        assert metrics.total_time_ms == 150.5
        assert metrics.input_tokens == 10
        assert metrics.output_tokens == 20
        assert metrics.time_to_first_token_ms is None

    def test_create_metrics_with_ttft(self) -> None:
        metrics = LLMMetrics(
            total_time_ms=200.0,
            input_tokens=15,
            output_tokens=30,
            time_to_first_token_ms=50.0,
        )
        assert metrics.time_to_first_token_ms == 50.0


class TestLLMResponse:
    def test_create_response(self) -> None:
        metrics = LLMMetrics(total_time_ms=100.0, input_tokens=5, output_tokens=10)
        response = LLMResponse(
            content="Test response",
            model_id="claude-3-7-sonnet",
            provider="anthropic",
            metrics=metrics,
        )
        assert response.content == "Test response"
        assert response.model_id == "claude-3-7-sonnet"
        assert response.provider == "anthropic"
        assert response.metrics == metrics
        assert response.finish_reason is None

    def test_create_response_with_finish_reason(self) -> None:
        metrics = LLMMetrics(total_time_ms=100.0, input_tokens=5, output_tokens=10)
        response = LLMResponse(
            content="Done",
            model_id="claude",
            provider="bedrock",
            metrics=metrics,
            finish_reason="end_turn",
        )
        assert response.finish_reason == "end_turn"
