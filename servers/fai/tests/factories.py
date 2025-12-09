import uuid
from datetime import (
    UTC,
    datetime,
)
from typing import Any

from fai.models.api.chat_api import PostChatCompletionRequest
from fai.models.api.code_api import (
    CreateCodeRecordRequest,
    DeleteCodeRecordRequest,
)
from fai.models.api.document_api import (
    CreateDocumentRequest,
    DeleteDocumentRequest,
    UpdateDocumentRequest,
)
from fai.models.api.guidance_api import (
    CreateGuidanceRequest,
    UpdateGuidanceRequest,
)
from fai.models.api.website_api import (
    DeleteWebsiteRequest,
    IndexWebsiteRequest,
    ReindexWebsiteRequest,
)
from fai.models.types.chat_types import ChatMessage
from fai.models.types.query_types import Query


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
            model=model or "claude-4-sonnet",
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


class CreateCodeRequestFactory:
    @classmethod
    def build(
        cls,
        document: str | None = None,
        chunk: str | None = None,
        title: str | None = None,
        url: str | None = None,
        version: str | None = None,
        product: str | None = None,
        keywords: list[str] | None = None,
        authed: bool | None = None,
    ) -> CreateCodeRecordRequest:
        return CreateCodeRecordRequest(
            document=document or "def hello():\n    return 'Hello, World!'",
            chunk=chunk,
            title=title or "Test Code",
            url=url or "https://github.com/example/repo/blob/main/hello.py",
            version=version,
            product=product,
            keywords=keywords or ["python", "function"],
            authed=authed,
        )


class DeleteCodeRequestFactory:
    @classmethod
    def build(cls, code_id: str) -> DeleteCodeRecordRequest:
        return DeleteCodeRecordRequest(code_id=code_id)


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


class IndexWebsiteRequestFactory:
    @classmethod
    def build(
        cls,
        base_url: str | None = None,
        domain_filter: str | None = None,
        path_filter: str | None = None,
        url_pattern: str | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        min_content_length: int | None = None,
        max_pages: int | None = None,
        delay: float | None = None,
        version: str | None = None,
        product: str | None = None,
        authed: bool | None = None,
    ) -> IndexWebsiteRequest:
        return IndexWebsiteRequest(
            base_url=base_url or "https://example.com/docs",
            domain_filter=domain_filter,
            path_filter=path_filter,
            url_pattern=url_pattern,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            min_content_length=min_content_length,
            max_pages=max_pages or 10,
            delay=delay,
            version=version,
            product=product,
            authed=authed,
        )


class ReindexWebsiteRequestFactory:
    @classmethod
    def build(
        cls,
        base_url: str | None = None,
        domain_filter: str | None = None,
        path_filter: str | None = None,
        url_pattern: str | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        min_content_length: int | None = None,
        max_pages: int | None = None,
        delay: float | None = None,
        version: str | None = None,
        product: str | None = None,
        authed: bool | None = None,
    ) -> ReindexWebsiteRequest:
        return ReindexWebsiteRequest(
            base_url=base_url or "https://example.com/docs",
            domain_filter=domain_filter,
            path_filter=path_filter,
            url_pattern=url_pattern,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            min_content_length=min_content_length,
            max_pages=max_pages,
            delay=delay,
            version=version,
            product=product,
            authed=authed,
        )


class DeleteWebsiteRequestFactory:
    @classmethod
    def build(cls, base_url: str | None = None) -> DeleteWebsiteRequest:
        return DeleteWebsiteRequest(base_url=base_url or "https://example.com/docs")


def mock_external_services(**kwargs: Any) -> dict[str, Any]:
    """Mock external service calls for testing."""
    return {"mocked": True, **kwargs}
