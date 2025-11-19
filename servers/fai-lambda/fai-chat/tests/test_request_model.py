import pytest
from pydantic import ValidationError

from src.models.request import ChatRequest


class TestChatRequest:
    def test_create_valid_request(self) -> None:
        request = ChatRequest(domain="buildwithfern.docs.buildwithfern.com")

        assert request.domain == "buildwithfern.docs.buildwithfern.com"

    def test_create_request_with_different_domain(self) -> None:
        request = ChatRequest(domain="test.example.com")

        assert request.domain == "test.example.com"

    def test_missing_domain_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest()

    def test_none_domain_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest(domain=None)

    def test_empty_string_domain(self) -> None:
        request = ChatRequest(domain="")

        assert request.domain == ""

    def test_domain_with_special_characters(self) -> None:
        request = ChatRequest(domain="my-domain.docs.example.com")

        assert request.domain == "my-domain.docs.example.com"

    def test_request_from_dict(self) -> None:
        data = {"domain": "buildwithfern.docs.buildwithfern.com"}
        request = ChatRequest(**data)

        assert request.domain == "buildwithfern.docs.buildwithfern.com"

    def test_request_to_dict(self) -> None:
        request = ChatRequest(domain="buildwithfern.docs.buildwithfern.com")
        data = request.model_dump()

        assert data == {"domain": "buildwithfern.docs.buildwithfern.com"}

    def test_extra_fields_ignored(self) -> None:
        request = ChatRequest(domain="test.com", extra_field="ignored")

        assert request.domain == "test.com"
        assert not hasattr(request, "extra_field")
