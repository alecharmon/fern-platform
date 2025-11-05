from datetime import (
    UTC,
    datetime,
)
from unittest.mock import (
    AsyncMock,
    patch,
)

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.api.website_api import (
    DeleteAllWebsitesResponse,
    DeleteWebsiteResponse,
    GetWebsiteResponse,
    GetWebsitesResponse,
    GetWebsiteStatusResponse,
    IndexWebsiteResponse,
    ReindexWebsiteResponse,
)
from fai.models.db.index_source_db import (
    IndexSourceDb,
    SourceType,
)
from fai.models.db.website_db import WebsiteDb
from tests.conftest import TEST_FERN_TOKEN
from tests.factories import (
    DeleteWebsiteRequestFactory,
    IndexWebsiteRequestFactory,
    ReindexWebsiteRequestFactory,
    create_test_domain,
    create_test_id,
)


class TestWebsiteRoutes:
    @pytest.mark.asyncio
    async def test_index_website(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test indexing a website creates a job and index source."""
        domain = create_test_domain()
        mock_request = IndexWebsiteRequestFactory.build()

        with patch("fai.routes.website.job_manager.create_job", new_callable=AsyncMock) as mock_create_job, patch(
            "fai.routes.website.job_manager.execute_job", new_callable=AsyncMock
        ):
            mock_create_job.return_value = "test-job-id"

            response = test_client.post(
                f"/sources/website/{domain}/index",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"

        data = response.json()
        try:
            response_model = IndexWebsiteResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.job_id == "test-job-id"
        assert response_model.base_url == mock_request.base_url

        # Verify index source was created in database
        stmt = select(IndexSourceDb).where(
            IndexSourceDb.domain == domain,
            IndexSourceDb.source_type == SourceType.WEBSITE,
            IndexSourceDb.source_identifier == mock_request.base_url,
        )
        result = await test_session.execute(stmt)
        index_source = result.scalar_one_or_none()

        assert index_source is not None, "Index source should exist in database"
        assert index_source.domain == domain
        assert index_source.source_identifier == mock_request.base_url
        assert index_source.status == "indexing"
        assert index_source.job_id == "test-job-id"
        assert index_source.config is not None

    @pytest.mark.asyncio
    async def test_index_website_already_indexing(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test indexing a website that's already being indexed returns existing job ID."""
        domain = create_test_domain()
        mock_request = IndexWebsiteRequestFactory.build()

        # First request
        with patch("fai.routes.website.job_manager.create_job", new_callable=AsyncMock) as mock_create_job, patch(
            "fai.routes.website.job_manager.execute_job", new_callable=AsyncMock
        ):
            mock_create_job.return_value = "test-job-id-1"
            response1 = test_client.post(
                f"/sources/website/{domain}/index",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["job_id"] == "test-job-id-1"

        # Second request while first is still indexing
        response2 = test_client.post(
            f"/sources/website/{domain}/index",
            json=mock_request.model_dump(mode="json"),
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response2.status_code == 200
        data2 = response2.json()
        # Should return the same job ID
        assert data2["job_id"] == "test-job-id-1"

    @pytest.mark.asyncio
    async def test_reindex_website(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test reindexing a website uses stored config."""
        domain = create_test_domain()
        index_request = IndexWebsiteRequestFactory.build(
            base_url="https://example.com/docs", version="1.0", product="test-product"
        )

        # First index the website
        with patch("fai.routes.website.job_manager.create_job", new_callable=AsyncMock) as mock_create_job, patch(
            "fai.routes.website.job_manager.execute_job", new_callable=AsyncMock
        ):
            mock_create_job.return_value = "test-job-id-1"
            response = test_client.post(
                f"/sources/website/{domain}/index",
                json=index_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )
        assert response.status_code == 200

        # Mark it as completed
        stmt = select(IndexSourceDb).where(
            IndexSourceDb.domain == domain, IndexSourceDb.source_identifier == index_request.base_url
        )
        result = await test_session.execute(stmt)
        index_source = result.scalar_one_or_none()
        index_source.status = "active"
        await test_session.commit()

        # Now reindex
        reindex_request = ReindexWebsiteRequestFactory.build(base_url=index_request.base_url)
        with patch("fai.routes.website.job_manager.create_job", new_callable=AsyncMock) as mock_create_job, patch(
            "fai.routes.website.job_manager.execute_job", new_callable=AsyncMock
        ):
            mock_create_job.return_value = "test-job-id-2"
            response = test_client.post(
                f"/sources/website/{domain}/reindex",
                json=reindex_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        data = response.json()
        try:
            response_model = ReindexWebsiteResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.job_id == "test-job-id-2"
        assert response_model.base_url == index_request.base_url

        # Verify status is back to indexing
        await test_session.refresh(index_source)
        assert index_source.status == "indexing"
        assert index_source.job_id == "test-job-id-2"

    @pytest.mark.asyncio
    async def test_reindex_website_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test reindexing a website that hasn't been indexed returns 404."""
        domain = create_test_domain()
        reindex_request = ReindexWebsiteRequestFactory.build()

        response = test_client.post(
            f"/sources/website/{domain}/reindex",
            json=reindex_request.model_dump(mode="json"),
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response.status_code == 404
        assert "has not been indexed" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_reindex_website_with_parameter_overrides(
        self, test_client: TestClient, test_session: AsyncSession
    ) -> None:
        """Test reindexing a website with parameter overrides."""
        domain = create_test_domain()
        # First index with initial config
        index_request = IndexWebsiteRequestFactory.build(
            chunk_size=500, chunk_overlap=100, max_pages=100, version="v1", delay=0.5
        )

        with patch("fai.routes.website.job_manager.create_job", new_callable=AsyncMock) as mock_create_job, patch(
            "fai.routes.website.job_manager.execute_job", new_callable=AsyncMock
        ):
            mock_create_job.return_value = "test-job-id-1"
            response = test_client.post(
                f"/sources/website/{domain}/index",
                json=index_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )
        assert response.status_code == 200

        # Mark it as completed
        stmt = select(IndexSourceDb).where(
            IndexSourceDb.domain == domain, IndexSourceDb.source_identifier == index_request.base_url
        )
        result = await test_session.execute(stmt)
        index_source = result.scalar_one_or_none()
        index_source.status = "active"
        await test_session.commit()

        # Now reindex with some parameter overrides
        reindex_request = ReindexWebsiteRequestFactory.build(
            base_url=index_request.base_url,
            chunk_size=1000,
            version="v2",
            max_pages=200,  # Override chunk_size  # Override version  # Override max_pages
        )
        with patch("fai.routes.website.job_manager.create_job", new_callable=AsyncMock) as mock_create_job, patch(
            "fai.routes.website.job_manager.execute_job", new_callable=AsyncMock
        ):
            mock_create_job.return_value = "test-job-id-2"
            response = test_client.post(
                f"/sources/website/{domain}/reindex",
                json=reindex_request.model_dump(mode="json", exclude_none=True),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200

        # Verify the config was updated with overrides
        await test_session.refresh(index_source)
        config = index_source.config

        # Check overridden values
        assert config["chunk_size"] == 1000, "chunk_size should be overridden"
        assert config["version"] == "v2", "version should be overridden"
        assert config["max_pages"] == 200, "max_pages should be overridden"

        # Check preserved values
        assert config["chunk_overlap"] == 100, "chunk_overlap should be preserved from original"
        assert config["delay"] == 0.5, "delay should be preserved from original"
        assert config["base_url"] == index_request.base_url, "base_url should be preserved"

    @pytest.mark.asyncio
    async def test_get_website_status(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test getting website status by job ID."""
        domain = create_test_domain()
        # Use unique identifiers to avoid conflicts with other tests
        unique_base_url = f"https://example-{create_test_id()[:8]}.com/docs"
        unique_job_id = f"test-job-{create_test_id()[:8]}"
        mock_request = IndexWebsiteRequestFactory.build(base_url=unique_base_url)

        # Create index source first
        with patch("fai.routes.website.job_manager.create_job", new_callable=AsyncMock) as mock_create_job, patch(
            "fai.routes.website.job_manager.execute_job", new_callable=AsyncMock
        ):
            mock_create_job.return_value = unique_job_id
            test_client.post(
                f"/sources/website/{domain}/index",
                json=mock_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        # Mock job status
        with patch("fai.routes.website.job_manager.get_job_status", new_callable=AsyncMock) as mock_get_job:
            from fai.models.db.job_db import JobDb

            mock_job = JobDb(id=unique_job_id, status="in_progress", created_at=datetime.now(UTC))
            mock_get_job.return_value = mock_job

            response = test_client.get(
                f"/sources/website/{domain}/status?job_id={unique_job_id}",
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200, f"Unexpected response: {response.text}"
        data = response.json()
        try:
            response_model = GetWebsiteStatusResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.job_id == unique_job_id
        assert response_model.status == "in_progress"
        assert response_model.base_url == unique_base_url

    @pytest.mark.asyncio
    async def test_get_website_status_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test getting status for non-existent job returns 404."""
        domain = create_test_domain()

        with patch("fai.routes.website.job_manager.get_job_status", new_callable=AsyncMock) as mock_get_job:
            mock_get_job.return_value = None

            response = test_client.get(
                f"/sources/website/{domain}/status?job_id=non-existent-job",
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_websites_paginated(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test listing websites with pagination."""
        domain = create_test_domain()

        # Create mock website entries
        for i in range(5):
            website = WebsiteDb(
                id=create_test_id(),
                domain=domain,
                base_url="https://example.com/docs",
                page_url=f"https://example.com/docs/page{i}",
                chunk=f"Test chunk {i}",
                document=f"Test document {i}",
                title=f"Page {i}",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            test_session.add(website)
        await test_session.commit()

        # Get paginated results
        response = test_client.get(
            f"/sources/website/{domain}?page=1&limit=3", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()
        try:
            response_model = GetWebsitesResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert len(response_model.websites) == 3
        assert response_model.pagination.total == 5
        assert response_model.pagination.page == 1
        assert response_model.pagination.limit == 3

    @pytest.mark.asyncio
    async def test_get_websites_invalid_pagination(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test invalid pagination parameters return 400."""
        domain = create_test_domain()

        # Test invalid page
        response = test_client.get(
            f"/sources/website/{domain}?page=0&limit=10", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400

        # Test invalid limit
        response = test_client.get(
            f"/sources/website/{domain}?page=1&limit=0", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400

        # Test limit too large
        response = test_client.get(
            f"/sources/website/{domain}?page=1&limit=2000", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_website_by_id(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test getting a single website by ID."""
        domain = create_test_domain()
        website_id = create_test_id()

        website = WebsiteDb(
            id=website_id,
            domain=domain,
            base_url="https://example.com/docs",
            page_url="https://example.com/docs/page1",
            chunk="Test chunk content",
            document="Test document content",
            title="Test Page",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        test_session.add(website)
        await test_session.commit()

        response = test_client.get(
            f"/sources/website/{domain}/{website_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()
        try:
            response_model = GetWebsiteResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.website.website_id == website_id
        assert response_model.website.title == "Test Page"

    @pytest.mark.asyncio
    async def test_get_website_by_id_not_found(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test getting a non-existent website returns 404."""
        domain = create_test_domain()
        non_existent_id = create_test_id()

        response = test_client.get(
            f"/sources/website/{domain}/{non_existent_id}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_website(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test deleting a website by base URL."""
        domain = create_test_domain()
        base_url = "https://example.com/docs"

        # Create some website entries
        for i in range(3):
            website = WebsiteDb(
                id=create_test_id(),
                domain=domain,
                base_url=base_url,
                page_url=f"{base_url}/page{i}",
                chunk=f"Test chunk {i}",
                document=f"Test document {i}",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            test_session.add(website)
        await test_session.commit()

        delete_request = DeleteWebsiteRequestFactory.build(base_url=base_url)

        with patch("fai.routes.website.delete_websites_from_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.website.delete_websites_from_query_index", new_callable=AsyncMock
        ):
            response = test_client.request(
                "DELETE",
                f"/sources/website/{domain}/delete",
                json=delete_request.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        data = response.json()
        try:
            response_model = DeleteWebsiteResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.success is True
        assert response_model.pages_deleted == 3

        # Verify pages are deleted
        stmt = select(WebsiteDb).where(WebsiteDb.domain == domain, WebsiteDb.base_url == base_url)
        result = await test_session.execute(stmt)
        websites = result.scalars().all()
        assert len(websites) == 0

    @pytest.mark.asyncio
    async def test_delete_all_websites(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test deleting all websites for a domain."""
        domain = create_test_domain()

        # Create website entries for different base URLs
        for i in range(5):
            website = WebsiteDb(
                id=create_test_id(),
                domain=domain,
                base_url=f"https://example{i}.com/docs",
                page_url=f"https://example{i}.com/docs/page",
                chunk=f"Test chunk {i}",
                document=f"Test document {i}",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            test_session.add(website)
        await test_session.commit()

        with patch("fai.routes.website.delete_websites_from_tpuf", new_callable=AsyncMock), patch(
            "fai.routes.website.delete_websites_from_query_index", new_callable=AsyncMock
        ):
            response = test_client.request(
                "DELETE",
                f"/sources/website/{domain}/delete-all",
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

        assert response.status_code == 200
        data = response.json()
        try:
            response_model = DeleteAllWebsitesResponse(**data)
        except ValidationError as e:
            pytest.fail(f"Failed to parse response: {e}")

        assert response_model.success is True
        assert response_model.pages_deleted == 5

        # Verify all pages are deleted
        stmt = select(WebsiteDb).where(WebsiteDb.domain == domain)
        result = await test_session.execute(stmt)
        websites = result.scalars().all()
        assert len(websites) == 0
