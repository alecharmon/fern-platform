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
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1", chunk_count=5)
        hash2 = ContentHashDb(domain=domain, parent_id="page-2", content_hash="hash2", chunk_count=10)
        hash3 = ContentHashDb(domain="other-domain", parent_id="page-3", content_hash="hash3", chunk_count=15)
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
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1", chunk_count=5)
        hash2 = ContentHashDb(domain=domain, parent_id="page-2", content_hash="hash2", chunk_count=10)
        hash3 = ContentHashDb(domain=domain, parent_id="page-3", content_hash="hash3", chunk_count=15)
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

    @pytest.mark.asyncio
    async def test_pagination_with_limit_and_offset(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test pagination with limit and offset."""
        domain = "test-domain"

        # Insert 25 test hashes
        hashes = [
            ContentHashDb(domain=domain, parent_id=f"page-{i:03d}", content_hash=f"hash{i}", chunk_count=i)
            for i in range(25)
        ]
        test_session.add_all(hashes)
        await test_session.commit()

        # Get first page (10 items)
        response1 = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": [], "limit": 10, "offset": 0},
        )
        assert response1.status_code == 200
        data1 = response1.json()
        assert len(data1["entries"]) == 10
        assert data1["total_count"] == 25
        assert data1["has_more"] is True
        # Should be ordered by parent_id
        assert data1["entries"][0]["parent_id"] == "page-000"

        # Get second page (10 items)
        response2 = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": [], "limit": 10, "offset": 10},
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert len(data2["entries"]) == 10
        assert data2["total_count"] == 25
        assert data2["has_more"] is True
        assert data2["entries"][0]["parent_id"] == "page-010"

        # Get third page (5 items remaining)
        response3 = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": [], "limit": 10, "offset": 20},
        )
        assert response3.status_code == 200
        data3 = response3.json()
        assert len(data3["entries"]) == 5
        assert data3["total_count"] == 25
        assert data3["has_more"] is False
        assert data3["entries"][0]["parent_id"] == "page-020"

        # Verify no overlap between pages
        page1_ids = {e["parent_id"] for e in data1["entries"]}
        page2_ids = {e["parent_id"] for e in data2["entries"]}
        page3_ids = {e["parent_id"] for e in data3["entries"]}
        assert len(page1_ids & page2_ids) == 0
        assert len(page1_ids & page3_ids) == 0
        assert len(page2_ids & page3_ids) == 0

    @pytest.mark.asyncio
    async def test_pagination_consistent_ordering(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test that pagination maintains consistent ordering across requests."""
        domain = "test-domain"

        # Insert hashes with non-sequential parent_ids
        hashes = [
            ContentHashDb(domain=domain, parent_id=f"page-z{i}", content_hash=f"hash{i}", chunk_count=i)
            for i in range(15)
        ]
        test_session.add_all(hashes)
        await test_session.commit()

        # Get all results in two pages
        response1 = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": [], "limit": 10, "offset": 0},
        )
        response2 = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": [], "limit": 10, "offset": 10},
        )

        all_ids_paginated = [e["parent_id"] for e in response1.json()["entries"]] + [
            e["parent_id"] for e in response2.json()["entries"]
        ]

        # Get all results without pagination
        response_all = test_client.post(
            f"/content-hash/{domain}/batch-get",
            json={"parent_ids": [], "limit": 1000, "offset": 0},
        )
        all_ids_direct = [e["parent_id"] for e in response_all.json()["entries"]]

        # Both should return the same IDs in the same order
        assert all_ids_paginated == all_ids_direct


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
                    {"parent_id": "page-1", "content_hash": "hash1", "chunk_count": 5},
                    {"parent_id": "page-2", "content_hash": "hash2", "chunk_count": 10},
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
        initial = ContentHashDb(domain=domain, parent_id="page-1", content_hash="old-hash", chunk_count=5)
        test_session.add(initial)
        await test_session.commit()

        # Update with new hash
        response = test_client.post(
            f"/content-hash/{domain}/batch-upsert",
            json={"entries": [{"parent_id": "page-1", "content_hash": "new-hash", "chunk_count": 10}]},
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
        existing = ContentHashDb(domain=domain, parent_id="page-1", content_hash="old-hash", chunk_count=5)
        test_session.add(existing)
        await test_session.commit()

        # Upsert mix of existing and new
        response = test_client.post(
            f"/content-hash/{domain}/batch-upsert",
            json={
                "entries": [
                    {"parent_id": "page-1", "content_hash": "updated-hash", "chunk_count": 10},
                    {"parent_id": "page-2", "content_hash": "new-hash", "chunk_count": 15},
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

    @pytest.mark.asyncio
    async def test_upsert_large_batch(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test upserting a large batch of content hashes (simulates huge docs site)."""
        domain = "test-domain"

        # Create 1500 entries to simulate a large docs site
        entries = [
            {"parent_id": f"page-{i:04d}", "content_hash": f"hash{i}", "chunk_count": i % 20} for i in range(1500)
        ]

        # Upsert all entries
        response = test_client.post(
            f"/content-hash/{domain}/batch-upsert",
            json={"entries": entries},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["upserted_count"] == 1500

        # Verify all hashes were inserted
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain)
        result = await test_session.execute(stmt)
        hashes = result.scalars().all()
        assert len(hashes) == 1500

    @pytest.mark.asyncio
    async def test_upsert_large_batch_mixed_operations(
        self, test_client: TestClient, test_session: AsyncSession
    ) -> None:
        """Test upserting a large batch with mix of updates and inserts."""
        domain = "test-domain"

        # Insert 500 existing hashes
        existing_hashes = [
            ContentHashDb(domain=domain, parent_id=f"page-{i:04d}", content_hash=f"old-hash{i}", chunk_count=5)
            for i in range(500)
        ]
        test_session.add_all(existing_hashes)
        await test_session.commit()

        # Upsert 1000 entries: 500 updates + 500 new inserts
        entries = [
            {"parent_id": f"page-{i:04d}", "content_hash": f"new-hash{i}", "chunk_count": i % 20} for i in range(1000)
        ]

        response = test_client.post(
            f"/content-hash/{domain}/batch-upsert",
            json={"entries": entries},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["upserted_count"] == 1000

        # Verify total count
        stmt = select(ContentHashDb).where(ContentHashDb.domain == domain)
        result = await test_session.execute(stmt)
        hashes = result.scalars().all()
        assert len(hashes) == 1000

        # Verify first 500 were updated (not duplicated)
        updated_hash = next(h for h in hashes if h.parent_id == "page-0000")
        assert updated_hash.content_hash == "new-hash0"  # Updated, not old-hash0

        # Verify last 500 are new
        new_hash = next(h for h in hashes if h.parent_id == "page-0999")
        assert new_hash.content_hash == "new-hash999"


class TestDeleteContentHashes:
    """Test deleting content hashes."""

    @pytest.mark.asyncio
    async def test_delete_hashes(self, test_client: TestClient, test_session: AsyncSession) -> None:
        """Test deleting content hashes."""
        domain = "test-domain"

        # Insert test hashes
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1", chunk_count=5)
        hash2 = ContentHashDb(domain=domain, parent_id="page-2", content_hash="hash2", chunk_count=10)
        hash3 = ContentHashDb(domain=domain, parent_id="page-3", content_hash="hash3", chunk_count=15)
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
        hash1 = ContentHashDb(domain=domain, parent_id="page-1", content_hash="hash1", chunk_count=5)
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
