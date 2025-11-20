import pytest
from pydantic import ValidationError

from src.models.request import ChatMessage, ChatRequest, TextPart, UIMessage


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
        data = {"messages": [{"role": "user", "parts": [{"type": "text", "text": "Hello"}]}]}
        request = ChatRequest(**data)

        assert len(request.messages) == 1
        assert isinstance(request.messages[0], UIMessage)
        assert request.messages[0].role == "user"

    def test_create_request_with_multiple_messages(self) -> None:
        data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Hello"}]},
                {"role": "assistant", "parts": [{"type": "text", "text": "Hi!"}]},
                {"role": "user", "parts": [{"type": "text", "text": "How are you?"}]},
            ]
        }
        request = ChatRequest(**data)

        assert len(request.messages) == 3
        assert request.messages[-1].parts[0].text == "How are you?"

    def test_missing_messages_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest()

    def test_empty_messages_list_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest(messages=[])

    def test_request_with_all_fields(self) -> None:
        data = {
            "messages": [{"role": "user", "parts": [{"type": "text", "text": "Hello"}]}],
            "source": "CHAT",
            "filters": [{"field": "category", "value": "api"}],
            "conversationId": "conv-123",
            "queryId": "query-456",
            "documentUrls": ["https://example.com/doc1"],
            "skipSaveQuery": True,
        }
        request = ChatRequest(**data)

        assert request.source == "CHAT"
        assert len(request.filters) == 1
        assert request.filters[0].field == "category"
        assert request.conversationId == "conv-123"
        assert request.queryId == "query-456"
        assert len(request.documentUrls) == 1
        assert request.skipSaveQuery is True

    def test_request_to_dict(self) -> None:
        data = {"messages": [{"role": "user", "parts": [{"type": "text", "text": "Hello"}]}]}
        request = ChatRequest(**data)
        result = request.model_dump()

        assert result["messages"][0]["role"] == "user"
        assert result["messages"][0]["parts"][0]["text"] == "Hello"
        assert result["source"] is None
        assert result["filters"] == []
        assert result["conversationId"] is None
        assert result["queryId"] is None
        assert result["documentUrls"] == []
        assert result["skipSaveQuery"] is False

    def test_get_simple_messages(self) -> None:
        data = {
            "messages": [
                {"role": "user", "parts": [{"type": "text", "text": "Hello "}]},
                {"role": "assistant", "parts": [{"type": "text", "text": "Hi there!"}]},
            ]
        }
        request = ChatRequest(**data)
        simple_messages = request.get_simple_messages()

        assert len(simple_messages) == 2
        assert isinstance(simple_messages[0], ChatMessage)
        assert simple_messages[0].role == "user"
        assert simple_messages[0].content == "Hello "
        assert simple_messages[1].role == "assistant"
        assert simple_messages[1].content == "Hi there!"

    def test_get_simple_messages_with_multiple_text_parts(self) -> None:
        data = {
            "messages": [
                {
                    "role": "user",
                    "parts": [{"type": "text", "text": "Hello "}, {"type": "text", "text": "world!"}],
                }
            ]
        }
        request = ChatRequest(**data)
        simple_messages = request.get_simple_messages()

        assert len(simple_messages) == 1
        assert simple_messages[0].content == "Hello world!"


class TestUIMessage:
    def test_create_ui_message_with_text_part(self) -> None:
        message = UIMessage(role="user", parts=[TextPart(type="text", text="Hello world")])

        assert message.role == "user"
        assert len(message.parts) == 1
        assert message.parts[0].type == "text"
        assert message.parts[0].text == "Hello world"

    def test_create_ui_message_with_multiple_text_parts(self) -> None:
        message = UIMessage(
            role="user",
            parts=[
                TextPart(type="text", text="Hello "),
                TextPart(type="text", text="world"),
            ],
        )

        assert len(message.parts) == 2
        assert message.parts[0].text == "Hello "
        assert message.parts[1].text == "world"
