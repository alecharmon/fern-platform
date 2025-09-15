import uuid
from datetime import (
    UTC,
    datetime,
)
from typing import Any

from src.fai.models.api.chat_api import PostChatCompletionRequest
from src.fai.models.api.document_api import (
    CreateDocumentRequest,
    DeleteDocumentRequest,
    UpdateDocumentRequest,
)
from src.fai.models.api.guidance_api import (
    CreateGuidanceRequest,
    UpdateGuidanceRequest,
)
from src.fai.models.types.chat_types import ChatMessage
from src.fai.models.types.query_types import Query


class ChatMessageFactory:
    @classmethod
    def build(cls, role: str = "user", content: str = "Test message") -> ChatMessage:
        return ChatMessage(role=role, content=content)


class PostChatCompletionRequestFactory:
    @classmethod
    def build(
        cls,
        model: str | None = None,
        system_prompt: str | None = None,
        messages: list[ChatMessage] | None = None,
    ) -> PostChatCompletionRequest:
        return PostChatCompletionRequest(
            model=model or "claude-4-sonnet-20250514",
            system_prompt=system_prompt or "You are a helpful assistant.",
            messages=messages or [ChatMessageFactory.build()],
        )


class CreateDocumentRequestFactory:
    @classmethod
    def build(
        cls,
        document: str | None = None,
        chunk: str | None = None,
        title: str | None = None,
        url: str | None = None,
        version: str | None = None,
        keywords: list[str] | None = None,
        authed: bool | None = None,
    ) -> CreateDocumentRequest:
        return CreateDocumentRequest(
            document=document or "Test document content",
            chunk=chunk,
            title=title or "Test Document",
            url=url or "https://example.com/doc",
            version=version or "1.0.0",
            keywords=keywords or ["test", "document"],
            authed=authed or False,
        )


class UpdateDocumentRequestFactory:
    @classmethod
    def build(
        cls,
        document: str | None = None,
        chunk: str | None = None,
        title: str | None = None,
        url: str | None = None,
        version: str | None = None,
        keywords: list[str] | None = None,
        authed: bool | None = None,
    ) -> UpdateDocumentRequest:
        return UpdateDocumentRequest(
            document=document,
            chunk=chunk,
            title=title,
            url=url,
            version=version,
            keywords=keywords,
            authed=authed,
        )


class DeleteDocumentRequestFactory:
    @classmethod
    def build(cls, document_id: str) -> DeleteDocumentRequest:
        return DeleteDocumentRequest(document_id=document_id)


class CreateGuidanceRequestFactory:
    @classmethod
    def build(
        cls,
        context: list[str] | None = None,
        document: str | None = None,
    ) -> CreateGuidanceRequest:
        return CreateGuidanceRequest(
            context=context or ["Test guidance context"],
            document=document or "Test guidance document content",
        )


class UpdateGuidanceRequestFactory:
    @classmethod
    def build(
        cls,
        context: list[str] | None = None,
        document: str | None = None,
    ) -> UpdateGuidanceRequest:
        return UpdateGuidanceRequest(
            context=context,
            document=document,
        )


class QueryFactory:
    @classmethod
    def build(
        cls,
        query_id: str | None = None,
        conversation_id: str | None = None,
        domain: str | None = None,
        text: str | None = None,
        role: str | None = None,
        source: str | None = None,
        created_at: datetime | None = None,
        time_to_first_token: float | None = None,
    ) -> Query:
        return Query(
            query_id=query_id or str(uuid.uuid4()),
            conversation_id=conversation_id or str(uuid.uuid4()),
            domain=domain or "test-domain",
            text=text or "Test query text",
            role=role or "USER",
            source=source or "test",
            created_at=created_at or datetime.now(UTC),
            time_to_first_token=time_to_first_token,
        )


def create_test_domain() -> str:
    """Generate a test domain name."""
    return f"test-domain-{uuid.uuid4().hex[:8]}"


def create_test_id() -> str:
    """Generate a test ID."""
    return str(uuid.uuid4())


def mock_external_services(**kwargs: Any) -> dict[str, Any]:
    """Mock external service calls for testing."""
    return {"mocked": True, **kwargs}
