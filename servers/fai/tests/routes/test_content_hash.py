"""Tests for content hash routes."""

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.content_hash_db import ContentHashDb


@pytest_asyncio.fixture(autouse=True)
async def cleanup_content_hashes(test_session: AsyncSession) -> AsyncGenerator[None, None]:
    """Clean up content hashes between tests."""
    yield
    # Clean up after each test
    await test_session.execute(delete(ContentHashDb))
    await test_session.commit()


class TestBatchGetContentHashes:
    """Test batch getting content hashes."""

    @pytest.mark.asyncio
    async def test_get_all_hashes_for_domain(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test getting all content hashes when parent_ids is empty."""
        domain = "test-domain"

        # Insert test data
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1")
        hash2 = ContentHashDb(domain=domain, parent_id="page-2", content_hash="hash2")
        hash3 = ContentHashDb(domain="other-domain", parent_id="page-3", content_hash="hash3")
        test_session.add_all([hash1, hash2, hash3])
        await test_session.commit()

        # Get all hashes for domain
        response = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": []},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 2
        assert {entry["parent_id"] for entry in data["entries"]} == {"page-1", "page-2"}

    @pytest.mark.asyncio
    async def test_get_specific_hashes(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test getting specific content hashes by parent_ids."""
        domain = "test-domain"

        # Insert test data
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1")
        hash2 = ContentHashDb(domain=domain, parent_id="page-2", content_hash="hash2")
        hash3 = ContentHashDb(domain=domain, parent_id="page-3", content_hash="hash3")
        test_session.add_all([hash1, hash2, hash3])
        await test_session.commit()

        # Get specific hashes
        response = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": ["page-1", "page-3"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 2
        assert {entry["parent_id"] for entry in data["entries"]} == {"page-1", "page-3"}

    @pytest.mark.asyncio
    async def test_get_empty_domain(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test getting hashes for a domain with no data."""
        response = test_client.post(
            "/content-hash/empty-domain/batch-get",
            json={"parent_ids": []},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 0


class TestBatchUpsertContentHashes:
    """Test batch upserting content hashes."""

    @pytest.mark.asyncio
    async def test_upsert_new_hashes(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test inserting new content hashes."""
        domain = "test-domain"

        response = test_client.post(
            f"/content-hash/{domain}/batch-upsert",
            json={
                "entries": [
                    {"parent_id": "page-1", "content_hash": "hash1"},
                    {"parent_id": "page-2", "content_hash": "hash2"},
                ]
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["upserted_count"] == 2

        # Verify hashes were inserted
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain)
        result = await test_session.execute(stmt)
        hashes = result.scalars().all()

        assert len(hashes) == 2
        hash_map = {h.parent_id: h.content_hash for h in hashes}
        assert hash_map == {"page-1": "hash1", "page-2": "hash2"}

    @pytest.mark.asyncio
    async def test_upsert_update_existing_hashes(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test updating existing content hashes."""
        domain = "test-domain"

        # Insert initial hash
        initial = ContentHashDb(domain=domain, parent_id="page-1", content_hash="old-hash")
        test_session.add(initial)
        await test_session.commit()

        # Update with new hash
        response = test_client.post(
            f"/content-hash/{domain}/batch-upsert",
            json={"entries": [{"parent_id": "page-1", "content_hash": "new-hash"}]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["upserted_count"] == 1

        # Verify hash was updated
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain, ContentHashDb.parent_id == "page-1")
        result = await test_session.execute(stmt)
        updated = result.scalar_one()

        assert updated.content_hash == "new-hash"

    @pytest.mark.asyncio
    async def test_upsert_mixed(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test upserting a mix of new and existing hashes."""
        domain = "test-domain"

        # Insert existing hash
        existing = ContentHashDb(domain=domain, parent_id="page-1", content_hash="old-hash")
        test_session.add(existing)
        await test_session.commit()

        # Upsert mix of existing and new
        response = test_client.post(
            f"/content-hash/{domain}/batch-upsert",
            json={
                "entries": [
                    {"parent_id": "page-1", "content_hash": "updated-hash"},
                    {"parent_id": "page-2", "content_hash": "new-hash"},
                ]
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["upserted_count"] == 2

        # Verify results
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain)
        result = await test_session.execute(stmt)
        hashes = result.scalars().all()

        assert len(hashes) == 2
        hash_map = {h.parent_id: h.content_hash for h in hashes}
        assert hash_map == {"page-1": "updated-hash", "page-2": "new-hash"}


class TestDeleteContentHashes:
    """Test deleting content hashes."""

    @pytest.mark.asyncio
    async def test_delete_hashes(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test deleting content hashes."""
        domain = "test-domain"

        # Insert test hashes
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1")
        hash2 = ContentHashDb(domain=domain, parent_id="page-2", content_hash="hash2")
        hash3 = ContentHashDb(domain=domain, parent_id="page-3", content_hash="hash3")
        test_session.add_all([hash1, hash2, hash3])
        await test_session.commit()

        # Delete page-2 and page-3
        response = test_client.request(
            "DELETE",
            f"/content-hash/{domain}/delete",
            json={"parent_ids": ["page-2", "page-3"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 2

        # Verify only page-1 remains
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain)
        result = await test_session.execute(stmt)
        remaining = result.scalars().all()

        assert len(remaining) == 1
        assert remaining[0].parent_id == "page-1"

    @pytest.mark.asyncio
    async def test_delete_empty_list(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test deleting with empty list does nothing."""
        domain = "test-domain"

        # Insert test hash
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1")
        test_session.add(hash1)
        await test_session.commit()

        # Delete empty list
        response = test_client.request(
            "DELETE",
            f"/content-hash/{domain}/delete",
            json={"parent_ids": []},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 0

        # Verify hash still exists
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain)
        result = await test_session.execute(stmt)
        remaining = result.scalars().all()

        assert len(remaining) == 1

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test deleting nonexistent hashes returns 0."""
        domain = "test-domain"

        response = test_client.request(
            "DELETE",
            f"/content-hash/{domain}/delete",
            json={"parent_ids": ["nonexistent-1", "nonexistent-2"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 0
