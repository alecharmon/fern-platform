from unittest.mock import (
    AsyncMock,
    patch,
)

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.models.api.document_api import (
    CreateDocumentResponse,
    DeleteDocumentResponse,
    GetDocumentResponse,
    GetDocumentsResponse,
    UpdateDocumentResponse,
)
from src.fai.models.db.document_db import DocumentDb
from tests.factories import (
    CreateDocumentRequestFactory,
    UpdateDocumentRequestFactory,
    create_test_domain,
    create_test_id,
)


class TestDocumentRoutes:
    @pytest.mark.asyncio
    async def test_create_document(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        mock_request = CreateDocumentRequestFactory.build()

        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(f"/document/{domain}/create", json=mock_request.model_dump(mode="json"))

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = CreateDocumentResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        # Verify document exists in database
        stmt = select(DocumentDb).where(DocumentDb.id == response_model.document_id)
        result = await test_session.execute(stmt)
        document = result.scalar_one_or_none()

        assert document is not None, "Document should exist in database"
        assert document.domain == domain, "Domain should match request"
        assert document.document == mock_request.document, "Document content should match request"
        assert document.title == mock_request.title, "Title should match request"
        assert document.url == mock_request.url, "URL should match request"
        assert document.version == mock_request.version, "Version should match request"
        assert document.keywords == mock_request.keywords, "Keywords should match request"
        assert document.authed == mock_request.authed, "Authed status should match request"

    @pytest.mark.asyncio
    async def test_create_document_with_chunk(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        mock_request = CreateDocumentRequestFactory.build(chunk="Custom chunk content")

        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(f"/document/{domain}/create", json=mock_request.model_dump(mode="json"))

        assert response.status_code == 200
        data = response.json()
        response_model = CreateDocumentResponse(**data)

        # Verify chunk is used when provided
        stmt = select(DocumentDb).where(DocumentDb.id == response_model.document_id)
        result = await test_session.execute(stmt)
        document = result.scalar_one_or_none()

        assert document is not None
        assert document.chunk == mock_request.chunk, "Chunk should match request when provided"

    @pytest.mark.asyncio
    async def test_create_document_without_chunk_uses_document(
        self, test_client: TestClient, test_session: AsyncSession
    ) -> None:
        domain = create_test_domain()
        mock_request = CreateDocumentRequestFactory.build(chunk=None)

        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(f"/document/{domain}/create", json=mock_request.model_dump(mode="json"))

        assert response.status_code == 200
        data = response.json()
        response_model = CreateDocumentResponse(**data)

        # Verify document content is used as chunk when chunk is not provided
        stmt = select(DocumentDb).where(DocumentDb.id == response_model.document_id)
        result = await test_session.execute(stmt)
        document = result.scalar_one_or_none()

        assert document is not None
        assert document.chunk == mock_request.document, "Chunk should default to document content"

    @pytest.mark.asyncio
    async def test_update_document(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create document first
        create_request = CreateDocumentRequestFactory.build()
        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/document/{domain}/create", json=create_request.model_dump(mode="json")
            )

        assert create_response.status_code == 200
        create_data = create_response.json()
        document_id = create_data["document_id"]

        # Update document
        update_request = UpdateDocumentRequestFactory.build(document="Updated document content", title="Updated Title")

        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.patch(
                f"/document/{domain}/{document_id}", json=update_request.model_dump(mode="json")
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            _ = UpdateDocumentResponse(**data)  # noqa: F841
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        # Verify document was updated in database
        stmt = select(DocumentDb).where(DocumentDb.id == document_id)
        result = await test_session.execute(stmt)
        document = result.scalar_one_or_none()

        assert document is not None, "Document should exist in database"
        assert document.document == update_request.document, "Document content should be updated"
        assert document.title == update_request.title, "Title should be updated"

    @pytest.mark.asyncio
    async def test_update_document_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()
        update_request = UpdateDocumentRequestFactory.build()

        response = test_client.patch(
            f"/document/{domain}/{non_existent_id}", json=update_request.model_dump(mode="json")
        )

        assert response.status_code == 404, "Should return 404 for non-existent document"

    @pytest.mark.asyncio
    async def test_delete_document(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create document first
        create_request = CreateDocumentRequestFactory.build()
        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/document/{domain}/create", json=create_request.model_dump(mode="json")
            )

        create_data = create_response.json()
        document_id = create_data["document_id"]

        # Delete document
        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.delete(f"/document/{domain}/{document_id}")

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = DeleteDocumentResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.success is True, "Deletion should be successful"

        # Verify document is removed from database
        stmt = select(DocumentDb).where(DocumentDb.id == document_id)
        result = await test_session.execute(stmt)
        document = result.scalar_one_or_none()

        assert document is None, "Document should be removed from database"

    @pytest.mark.asyncio
    async def test_delete_document_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()

        response = test_client.delete(f"/document/{domain}/{non_existent_id}")

        assert response.status_code == 200, "Should return 200 even for non-existent document"

        data = response.json()
        response_model = DeleteDocumentResponse(**data)
        assert response_model.success is False, "Deletion should be unsuccessful for non-existent document"

    @pytest.mark.asyncio
    async def test_get_document_by_id(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create document first
        create_request = CreateDocumentRequestFactory.build()
        with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/document/{domain}/create", json=create_request.model_dump(mode="json")
            )

        create_data = create_response.json()
        document_id = create_data["document_id"]

        # Get document
        response = test_client.get(f"/document/{domain}/{document_id}")

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = GetDocumentResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.document.document_id == document_id, "Document ID should match"
        assert response_model.document.document == create_request.document, "Document content should match"

    @pytest.mark.asyncio
    async def test_get_document_by_id_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()

        response = test_client.get(f"/document/{domain}/{non_existent_id}")

        assert response.status_code == 500, "Should return 500 for non-existent document"

    @pytest.mark.asyncio
    async def test_get_documents_paginated(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create multiple documents
        for i in range(5):
            create_request = CreateDocumentRequestFactory.build(title=f"Document {i}")
            with patch("src.fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
                "src.fai.routes.document.sync_index_to_target", new_callable=AsyncMock
            ):
                test_client.post(f"/document/{domain}/create", json=create_request.model_dump(mode="json"))

        # Get documents with pagination
        response = test_client.get(f"/document/{domain}?page=1&limit=3")

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = GetDocumentsResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert len(response_model.documents) == 3, "Should return 3 documents"
        assert response_model.pagination.total == 5, "Total should be 5"
        assert response_model.pagination.page == 1, "Page should be 1"
        assert response_model.pagination.limit == 3, "Limit should be 3"

    @pytest.mark.asyncio
    async def test_get_documents_invalid_pagination(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Test invalid page
        response = test_client.get(f"/document/{domain}?page=0&limit=10")
        assert response.status_code == 400, "Should return 400 for invalid page"

        # Test invalid limit
        response = test_client.get(f"/document/{domain}?page=1&limit=0")
        assert response.status_code == 400, "Should return 400 for invalid limit"

        # Test limit too large
        response = test_client.get(f"/document/{domain}?page=1&limit=2000")
        assert response.status_code == 400, "Should return 400 for limit too large"
