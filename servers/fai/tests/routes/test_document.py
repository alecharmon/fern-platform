from unittest.mock import (
    AsyncMock,
    patch,
)

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.api.document_api import (
    CreateDocumentResponse,
    DeleteDocumentResponse,
    GetDocumentResponse,
    GetDocumentsResponse,
    UpdateDocumentResponse,
)
from fai.models.db.document_db import DocumentDb
from tests.conftest import TEST_FERN_TOKEN
from tests.factories import (
    CreateDocumentRequestFactory,
    DeleteDocumentRequestFactory,
    UpdateDocumentRequestFactory,
    create_test_domain,
    create_test_id,
)


class TestDocumentRoutes:
    @pytest.mark.asyncio
    async def test_create_document(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        mock_request = CreateDocumentRequestFactory.build()

        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/document/{domain}/create",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_models = [CreateDocumentResponse(**item) for item in data]
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert len(response_models) >= 1, "Should return at least one document"

        # Verify all documents exist in database
        for response_model in response_models:
            stmt = select(DocumentDb).where(DocumentDb.id == response_model.document_id)
            result = await test_session.execute(stmt)
            document = result.scalar_one_or_none()

            assert document is not None, f"Document {response_model.document_id} should exist in database"
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

        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/document/{domain}/create",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        data = response.json()
        response_models = [CreateDocumentResponse(**item) for item in data]
        assert len(response_models) >= 1, "Should return at least one document"

        # Verify chunk is used when provided for all documents
        for response_model in response_models:
            stmt = select(DocumentDb).where(DocumentDb.id == response_model.document_id)
            result = await test_session.execute(stmt)
            document = result.scalar_one_or_none()

            assert document is not None, f"Document {response_model.document_id} should exist in database"
            # For chunked documents, the chunk field contains the actual chunk, not the original chunk
            assert mock_request.chunk in document.chunk, "Chunk content should be derived from request"

    @pytest.mark.asyncio
    async def test_create_document_without_chunk_uses_document(
        self, test_client: TestClient, test_session: AsyncSession
    ) -> None:
        domain = create_test_domain()
        mock_request = CreateDocumentRequestFactory.build(chunk=None)

        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/document/{domain}/create",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        data = response.json()
        response_models = [CreateDocumentResponse(**item) for item in data]
        assert len(response_models) >= 1, "Should return at least one document"

        # Verify document content is used as chunk when chunk is not provided for all documents
        for response_model in response_models:
            stmt = select(DocumentDb).where(DocumentDb.id == response_model.document_id)
            result = await test_session.execute(stmt)
            document = result.scalar_one_or_none()

            assert document is not None, f"Document {response_model.document_id} should exist in database"
            # For chunked documents, the chunk field contains the actual chunk derived from document
            assert mock_request.document in document.chunk, "Chunk should be derived from document content"

    @pytest.mark.asyncio
    async def test_update_document(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create document first
        create_request = CreateDocumentRequestFactory.build()
        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/document/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert create_response.status_code == 200
        create_data = create_response.json()
        document_id = create_data[0]["document_id"]

        # Update document
        update_request = UpdateDocumentRequestFactory.build(document="Updated document content", title="Updated Title")

        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.patch(
                f"/document/{domain}/{document_id}",
                json=update_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
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
            f"/document/{domain}/{non_existent_id}",
            json=update_request.model_dump(mode="json"),
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response.status_code == 404, "Should return 404 for non-existent document"

    @pytest.mark.asyncio
    async def test_delete_document(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create document first
        create_request = CreateDocumentRequestFactory.build()
        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/document/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        create_data = create_response.json()
        document_id = create_data[0]["document_id"]
        delete_request = DeleteDocumentRequestFactory.build(document_id=document_id)

        # Delete document
        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.request(
                "DELETE",
                f"/document/{domain}/delete",
                json=delete_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

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
        delete_request = DeleteDocumentRequestFactory.build(document_id=non_existent_id)
        response = test_client.request(
            "DELETE",
            f"/document/{domain}/delete",
            json=delete_request.model_dump(mode="json"),
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response.status_code == 200, "Should return 200 even for non-existent document"

        data = response.json()
        response_model = DeleteDocumentResponse(**data)
        assert response_model.success is False, "Deletion should be unsuccessful for non-existent document"

    @pytest.mark.asyncio
    async def test_get_document_by_id(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create document first
        create_request = CreateDocumentRequestFactory.build()
        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/document/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        create_data = create_response.json()
        document_id = create_data[0]["document_id"]

        # Get document
        response = test_client.get(
            f"/document/{domain}/{document_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

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

        response = test_client.get(
            f"/document/{domain}/{non_existent_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 500, "Should return 500 for non-existent document"

    @pytest.mark.asyncio
    async def test_get_documents_paginated(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create multiple documents
        for i in range(5):
            create_request = CreateDocumentRequestFactory.build(title=f"Document {i}")
            with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
                "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
            ):
                test_client.post(
                    f"/document/{domain}/create",
                    json=create_request.model_dump(mode="json"),
                    headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
                )

        # Get documents with pagination
        response = test_client.get(
            f"/document/{domain}?page=1&limit=3", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

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
        response = test_client.get(
            f"/document/{domain}?page=0&limit=10", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for invalid page"

        # Test invalid limit
        response = test_client.get(
            f"/document/{domain}?page=1&limit=0", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for invalid limit"

        # Test limit too large
        response = test_client.get(
            f"/document/{domain}?page=1&limit=2000", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for limit too large"

    @pytest.mark.asyncio
    async def test_batch_create_documents(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        batch_requests = [CreateDocumentRequestFactory.build(title=f"Document {i}") for i in range(3)]

        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/document/{domain}/batch-create",
                json=[req.model_dump(mode="json") for req in batch_requests],
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        assert len(data) == 3, "Should create 3 documents"

        for i, doc_response in enumerate(data):
            try:
                CreateDocumentResponse(**doc_response)
            except ValidationError as e:
                pytest.fail(f"Failed to parse response {i}: {e}")

        # Verify documents exist in database
        for i, doc_response in enumerate(data):
            document_id = doc_response["document_id"]
            stmt = select(DocumentDb).where(DocumentDb.id == document_id)
            result = await test_session.execute(stmt)
            document = result.scalar_one_or_none()

            assert document is not None, f"Document {i} should exist in database"
            assert document.domain == domain, f"Domain should match for document {i}"
            assert document.title == f"Document {i}", f"Title should match for document {i}"

    @pytest.mark.asyncio
    async def test_batch_delete_documents(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        create_requests = [CreateDocumentRequestFactory.build() for _ in range(3)]
        document_ids = []

        for req in create_requests:
            with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
                "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
            ):
                create_response = test_client.post(
                    f"/document/{domain}/create",
                    json=req.model_dump(mode="json"),
                    headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
                )
            create_data = create_response.json()
            document_ids.extend([doc["document_id"] for doc in create_data])

        delete_requests = [DeleteDocumentRequestFactory.build(document_id=doc_id) for doc_id in document_ids]
        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.request(
                "DELETE",
                f"/document/{domain}/batch-delete",
                json=[req.model_dump(mode="json") for req in delete_requests],
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = DeleteDocumentResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.success is True, "Batch deletion should be successful"

        # Verify all documents are removed from database
        for document_id in document_ids:
            stmt = select(DocumentDb).where(DocumentDb.id == document_id)
            result = await test_session.execute(stmt)
            document = result.scalar_one_or_none()
            assert document is None, f"Document {document_id} should be removed from database"

    @pytest.mark.asyncio
    async def test_batch_create_and_delete_flow(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        batch_requests = [CreateDocumentRequestFactory.build() for _ in range(5)]

        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/document/{domain}/batch-create",
                json=[req.model_dump(mode="json") for req in batch_requests],
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert create_response.status_code == 200
        create_data = create_response.json()
        document_ids = [doc["document_id"] for doc in create_data]

        assert len(document_ids) == 5, "Should create 5 documents"
        for document_id in document_ids:
            stmt = select(DocumentDb).where(DocumentDb.id == document_id)
            result = await test_session.execute(stmt)
            document = result.scalar_one_or_none()
            assert document is not None, f"Created document {document_id} should exist"

        delete_requests = [DeleteDocumentRequestFactory.build(document_id=doc_id) for doc_id in document_ids]
        with patch("fai.routes.document.sync_document_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.document.sync_index_to_target", new_callable=AsyncMock
        ):
            delete_response = test_client.request(
                "DELETE",
                f"/document/{domain}/batch-delete",
                json=[req.model_dump(mode="json") for req in delete_requests],
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert delete_response.status_code == 200
        delete_data = delete_response.json()
        assert delete_data["success"] is True, "Batch deletion should be successful"

        for document_id in document_ids:
            stmt = select(DocumentDb).where(DocumentDb.id == document_id)
            result = await test_session.execute(stmt)
            document = result.scalar_one_or_none()
            assert document is None, f"Deleted document {document_id} should not exist"
