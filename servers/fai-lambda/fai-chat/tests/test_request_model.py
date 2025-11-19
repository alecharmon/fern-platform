import pytest
from pydantic import ValidationError

from src.models.request import ChatMessage, ChatRequest


class TestChatMessage:
    def test_create_user_message(self) -> None:
        message = ChatMessage(role="user", content="Hello")

        assert message.role == "user"
        assert message.content == "Hello"

    def test_create_assistant_message(self) -> None:
        message = ChatMessage(role="assistant", content="Hi there!")

        assert message.role == "assistant"
        assert message.content == "Hi there!"

    def test_invalid_role_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ChatMessage(role="system", content="Test")


class TestChatRequest:
    def test_create_valid_request(self) -> None:
        messages = [ChatMessage(role="user", content="Hello")]
        request = ChatRequest(messages=messages)

        assert len(request.messages) == 1
        assert request.messages[0].role == "user"
        assert request.messages[0].content == "Hello"

    def test_create_request_with_multiple_messages(self) -> None:
        messages = [
            ChatMessage(role="user", content="Hello"),
            ChatMessage(role="assistant", content="Hi!"),
            ChatMessage(role="user", content="How are you?"),
        ]
        request = ChatRequest(messages=messages)

        assert len(request.messages) == 3
        assert request.messages[-1].content == "How are you?"

    def test_missing_messages_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest()

    def test_empty_messages_list_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest(messages=[])

    def test_request_from_dict(self) -> None:
        data = {"messages": [{"role": "user", "content": "Test"}]}
        request = ChatRequest(**data)

        assert len(request.messages) == 1
        assert request.messages[0].content == "Test"

    def test_request_to_dict(self) -> None:
        messages = [ChatMessage(role="user", content="Hello")]
        request = ChatRequest(messages=messages)
        data = request.model_dump()

        assert data == {"messages": [{"role": "user", "content": "Hello"}]}

    def test_extra_fields_ignored(self) -> None:
        messages = [ChatMessage(role="user", content="Hello")]
        request = ChatRequest(messages=messages, extra_field="ignored")

        assert len(request.messages) == 1
        assert not hasattr(request, "extra_field")
