from unittest.mock import (
    AsyncMock,
    patch,
)

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.api.code_api import (
    CreateCodeRecordResponse,
    DeleteCodeRecordResponse,
    GetCodeRecordResponse,
    GetCodeRecordsResponse,
)
from fai.models.db.code_db import CodeDb
from tests.conftest import TEST_FERN_TOKEN
from tests.factories import (
    CreateCodeRequestFactory,
    DeleteCodeRequestFactory,
    create_test_domain,
    create_test_id,
)


class TestCodeRoutes:
    @pytest.mark.asyncio
    async def test_create_code(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        mock_request = CreateCodeRequestFactory.build()

        with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/code/{domain}/create",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_models = [CreateCodeRecordResponse(**item) for item in data]
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert len(response_models) >= 1, "Should return at least one code entry"

        # Verify all code entries exist in database
        for response_model in response_models:
            stmt = select(CodeDb).where(CodeDb.id == response_model.code_id)
            result = await test_session.execute(stmt)
            code = result.scalar_one_or_none()

            assert code is not None, f"Code {response_model.code_id} should exist in database"
            assert code.domain == domain, "Domain should match request"
            assert code.document == mock_request.document, "Document content should match request"
            assert code.title == mock_request.title, "Title should match request"
            assert code.url == mock_request.url, "URL should match request"
            assert code.version is None, "Version should be None"
            assert code.product is None, "Product should be None"
            assert code.keywords == mock_request.keywords, "Keywords should match request"
            assert code.authed is None, "Authed should be None"

    @pytest.mark.asyncio
    async def test_create_code_with_chunk(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        mock_request = CreateCodeRequestFactory.build(chunk="Custom chunk content")

        with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/code/{domain}/create",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        data = response.json()
        response_models = [CreateCodeRecordResponse(**item) for item in data]
        assert len(response_models) >= 1, "Should return at least one code entry"

        # Verify chunk is used when provided for all code entries
        for response_model in response_models:
            stmt = select(CodeDb).where(CodeDb.id == response_model.code_id)
            result = await test_session.execute(stmt)
            code = result.scalar_one_or_none()

            assert code is not None, f"Code {response_model.code_id} should exist in database"
            assert mock_request.chunk in code.chunk, "Chunk content should be derived from request"

    @pytest.mark.asyncio
    async def test_create_code_without_chunk_uses_document(
        self, test_client: TestClient, test_session: AsyncSession
    ) -> None:
        domain = create_test_domain()
        mock_request = CreateCodeRequestFactory.build(chunk=None)

        with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/code/{domain}/create",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        data = response.json()
        response_models = [CreateCodeRecordResponse(**item) for item in data]
        assert len(response_models) >= 1, "Should return at least one code entry"

        # Verify document content is used as chunk when chunk is not provided
        for response_model in response_models:
            stmt = select(CodeDb).where(CodeDb.id == response_model.code_id)
            result = await test_session.execute(stmt)
            code = result.scalar_one_or_none()

            assert code is not None, f"Code {response_model.code_id} should exist in database"
            assert mock_request.document in code.chunk, "Chunk should be derived from document content"

    @pytest.mark.asyncio
    async def test_batch_create_code(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        batch_requests = [CreateCodeRequestFactory.build(title=f"Code {i}") for i in range(3)]

        with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/code/{domain}/batch-create",
                json=[req.model_dump(mode="json") for req in batch_requests],
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        assert len(data) >= 3, "Should create at least 3 code entries"

        for i, code_response in enumerate(data[:3]):
            try:
                CreateCodeRecordResponse(**code_response)
            except ValidationError as e:
                pytest.fail(f"Failed to parse response {i}: {e}")

        # Verify code entries exist in database
        for code_response in data[:3]:
            code_id = code_response["code_id"]
            stmt = select(CodeDb).where(CodeDb.id == code_id)
            result = await test_session.execute(stmt)
            code = result.scalar_one_or_none()

            assert code is not None, "Code should exist in database"
            assert code.domain == domain, "Domain should match"

    @pytest.mark.asyncio
    async def test_get_code_by_id(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create code first
        create_request = CreateCodeRequestFactory.build()
        with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/code/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        create_data = create_response.json()
        code_id = create_data[0]["code_id"]

        # Get code
        response = test_client.get(f"/code/{domain}/{code_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"})

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = GetCodeRecordResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.document.code_id == code_id, "Code ID should match"
        assert response_model.document.document == create_request.document, "Document content should match"

    @pytest.mark.asyncio
    async def test_get_code_by_id_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()

        response = test_client.get(
            f"/code/{domain}/{non_existent_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 404, "Should return 404 for non-existent code"

    @pytest.mark.asyncio
    async def test_get_code_paginated(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create multiple code entries
        for i in range(5):
            create_request = CreateCodeRequestFactory.build(title=f"Code {i}")
            with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
                "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
            ):
                test_client.post(
                    f"/code/{domain}/create",
                    json=create_request.model_dump(mode="json"),
                    headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
                )

        # Get code with pagination
        response = test_client.get(
            f"/code/{domain}?page=1&limit=3", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = GetCodeRecordsResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert len(response_model.documents) == 3, "Should return 3 code entries"
        assert response_model.pagination.total >= 5, "Total should be at least 5"
        assert response_model.pagination.page == 1, "Page should be 1"
        assert response_model.pagination.limit == 3, "Limit should be 3"

    @pytest.mark.asyncio
    async def test_get_code_invalid_pagination(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Test invalid page
        response = test_client.get(
            f"/code/{domain}?page=0&limit=10", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for invalid page"

        # Test invalid limit
        response = test_client.get(
            f"/code/{domain}?page=1&limit=0", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for invalid limit"

        # Test limit too large
        response = test_client.get(
            f"/code/{domain}?page=1&limit=2000", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for limit too large"

    @pytest.mark.asyncio
    async def test_delete_code_by_id(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create code first
        create_request = CreateCodeRequestFactory.build()
        with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/code/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        create_data = create_response.json()
        code_id = create_data[0]["code_id"]
        delete_request = DeleteCodeRequestFactory.build(code_id=code_id)

        # Delete code
        with patch("fai.routes.code.delete_code_from_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.delete_documents_from_query_index", new_callable=AsyncMock
        ):
            response = test_client.request(
                "DELETE",
                f"/code/{domain}/delete",
                json=delete_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = DeleteCodeRecordResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.success is True, "Deletion should be successful"

        # Verify code is removed from database
        stmt = select(CodeDb).where(CodeDb.id == code_id)
        result = await test_session.execute(stmt)
        code = result.scalar_one_or_none()

        assert code is None, "Code should be removed from database"

    @pytest.mark.asyncio
    async def test_delete_code_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()
        delete_request = DeleteCodeRequestFactory.build(code_id=non_existent_id)

        response = test_client.request(
            "DELETE",
            f"/code/{domain}/delete",
            json=delete_request.model_dump(mode="json"),
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response.status_code == 200, "Should return 200 even for non-existent code"

        data = response.json()
        response_model = DeleteCodeRecordResponse(**data)
        assert response_model.success is False, "Deletion should be unsuccessful for non-existent code"

    @pytest.mark.asyncio
    async def test_delete_all_code(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create multiple code entries
        code_ids = []
        for i in range(3):
            create_request = CreateCodeRequestFactory.build(title=f"Code {i}")
            with patch("fai.routes.code.sync_code_to_tpuf", new_callable=AsyncMock), patch(
                "fai.routes.code.sync_documents_to_query_index", new_callable=AsyncMock
            ):
                create_response = test_client.post(
                    f"/code/{domain}/create",
                    json=create_request.model_dump(mode="json"),
                    headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
                )
                create_data = create_response.json()
                code_ids.extend([item["code_id"] for item in create_data])

        # Delete all code
        with patch("fai.routes.code.sync_code_db_to_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.code.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.delete(
                f"/code/{domain}/delete-all", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = DeleteCodeRecordResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.success is True, "Deletion should be successful"

        # Verify all code entries are removed from database
        for code_id in code_ids:
            stmt = select(CodeDb).where(CodeDb.id == code_id)
            result = await test_session.execute(stmt)
            code = result.scalar_one_or_none()
            assert code is None, f"Code {code_id} should be removed from database"
