from unittest.mock import (
    AsyncMock,
    patch,
)

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.fai.models.api.guidance_api import (
    CreateGuidanceResponse,
    DeleteGuidanceResponse,
    GetGuidanceResponse,
    GetGuidancesResponse,
    UpdateGuidanceResponse,
)
from src.fai.models.db.guidance_db import GuidanceDb
from tests.conftest import TEST_FERN_TOKEN
from tests.factories import (
    CreateGuidanceRequestFactory,
    UpdateGuidanceRequestFactory,
    create_test_domain,
    create_test_id,
)


class TestGuidanceRoutes:
    @pytest.mark.asyncio
    async def test_create_guidance(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        mock_request = CreateGuidanceRequestFactory.build()

        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.post(
                f"/guidance/{domain}/create",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = CreateGuidanceResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        # Verify guidance exists in database
        stmt = select(GuidanceDb).where(GuidanceDb.id == response_model.guidance_id)
        result = await test_session.execute(stmt)
        guidance = result.scalar_one_or_none()

        assert guidance is not None, "Guidance should exist in database"
        assert guidance.domain == domain, "Domain should match request"
        assert guidance.context == mock_request.context, "Context should match request"
        assert guidance.document == mock_request.document, "Document should match request"

    @pytest.mark.asyncio
    async def test_update_guidance(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create guidance first
        create_request = CreateGuidanceRequestFactory.build()
        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/guidance/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert create_response.status_code == 200
        create_data = create_response.json()
        guidance_id = create_data["guidance_id"]

        # Update guidance
        update_request = UpdateGuidanceRequestFactory.build(
            context=["Updated guidance context"], document="Updated guidance document"
        )

        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.patch(
                f"/guidance/{domain}/{guidance_id}",
                json=update_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            _ = UpdateGuidanceResponse(**data)  # noqa: F841
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        # Verify guidance was updated in database
        stmt = select(GuidanceDb).where(GuidanceDb.id == guidance_id)
        result = await test_session.execute(stmt)
        guidance = result.scalar_one_or_none()

        assert guidance is not None, "Guidance should exist in database"
        assert guidance.context == update_request.context, "Context should be updated"
        assert guidance.document == update_request.document, "Document should be updated"

    @pytest.mark.asyncio
    async def test_update_guidance_partial_update(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create guidance first
        create_request = CreateGuidanceRequestFactory.build(context=["Original context"], document="Original document")
        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/guidance/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        create_data = create_response.json()
        guidance_id = create_data["guidance_id"]

        # Update only context
        update_request = UpdateGuidanceRequestFactory.build(context=["Updated context only"])

        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.patch(
                f"/guidance/{domain}/{guidance_id}",
                json=update_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200

        # Verify only context was updated
        stmt = select(GuidanceDb).where(GuidanceDb.id == guidance_id)
        result = await test_session.execute(stmt)
        guidance = result.scalar_one_or_none()

        assert guidance is not None
        assert guidance.context == update_request.context, "Context should be updated"
        assert guidance.document == create_request.document, "Document should remain unchanged"

    @pytest.mark.asyncio
    async def test_update_guidance_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()
        update_request = UpdateGuidanceRequestFactory.build()

        response = test_client.patch(
            f"/guidance/{domain}/{non_existent_id}",
            json=update_request.model_dump(mode="json"),
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response.status_code == 404, "Should return 404 for non-existent guidance"

    @pytest.mark.asyncio
    async def test_delete_guidance(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create guidance first
        create_request = CreateGuidanceRequestFactory.build()
        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/guidance/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        create_data = create_response.json()
        guidance_id = create_data["guidance_id"]

        # Delete guidance
        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            response = test_client.delete(
                f"/guidance/{domain}/{guidance_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = DeleteGuidanceResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.success is True, "Deletion should be successful"

        # Verify guidance is removed from database
        stmt = select(GuidanceDb).where(GuidanceDb.id == guidance_id)
        result = await test_session.execute(stmt)
        guidance = result.scalar_one_or_none()

        assert guidance is None, "Guidance should be removed from database"

    @pytest.mark.asyncio
    async def test_delete_guidance_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()

        response = test_client.delete(
            f"/guidance/{domain}/{non_existent_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200, "Should return 200 even for non-existent guidance"

        data = response.json()
        response_model = DeleteGuidanceResponse(**data)
        assert response_model.success is False, "Deletion should be unsuccessful for non-existent guidance"

    @pytest.mark.asyncio
    async def test_get_guidance_by_id(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create guidance first
        create_request = CreateGuidanceRequestFactory.build()
        with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
            "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
        ):
            create_response = test_client.post(
                f"/guidance/{domain}/create",
                json=create_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        create_data = create_response.json()
        guidance_id = create_data["guidance_id"]

        # Get guidance
        response = test_client.get(
            f"/guidance/{domain}/{guidance_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = GetGuidanceResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.guidance is not None, "Guidance should not be None"
        assert response_model.guidance.guidance_id == guidance_id, "Guidance ID should match"
        assert response_model.guidance.context == create_request.context, "Context should match"
        assert response_model.guidance.document == create_request.document, "Document should match"

    @pytest.mark.asyncio
    async def test_get_guidance_by_id_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_id = create_test_id()

        response = test_client.get(
            f"/guidance/{domain}/{non_existent_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 404, "Should return 404 for non-existent guidance"

        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Guidance not found"

    @pytest.mark.asyncio
    async def test_get_guidances_paginated(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Create multiple guidances
        for i in range(5):
            create_request = CreateGuidanceRequestFactory.build(context=[f"Context {i}"])
            with patch("src.fai.routes.guidance.sync_guidance_db_to_tpuf", new_callable=AsyncMock), patch(
                "src.fai.routes.guidance.sync_index_to_target", new_callable=AsyncMock
            ):
                test_client.post(
                    f"/guidance/{domain}/create",
                    json=create_request.model_dump(mode="json"),
                    headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
                )

        # Get guidances with pagination
        response = test_client.get(
            f"/guidance/{domain}?page=1&limit=3", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = GetGuidancesResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert len(response_model.guidances) == 3, "Should return 3 guidances"
        assert response_model.pagination.total == 5, "Total should be 5"
        assert response_model.pagination.page == 1, "Page should be 1"
        assert response_model.pagination.limit == 3, "Limit should be 3"

    @pytest.mark.asyncio
    async def test_get_guidances_invalid_pagination(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Test invalid page
        response = test_client.get(
            f"/guidance/{domain}?page=0&limit=10", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for invalid page"

        # Test invalid limit
        response = test_client.get(
            f"/guidance/{domain}?page=1&limit=0", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for invalid limit"

        # Test limit too large
        response = test_client.get(
            f"/guidance/{domain}?page=1&limit=2000", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400, "Should return 400 for limit too large"

    @pytest.mark.asyncio
    async def test_get_guidances_empty_domain(self, test_client: TestClient, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        # Get guidances for domain with no data
        response = test_client.get(
            f"/guidance/{domain}?page=1&limit=10", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        response_model = GetGuidancesResponse(**data)

        assert len(response_model.guidances) == 0, "Should return empty list"
        assert response_model.pagination.total == 0, "Total should be 0"
