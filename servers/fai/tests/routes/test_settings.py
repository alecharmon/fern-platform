from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.settings_db import SettingsDb


@pytest.mark.asyncio
async def test_enable_ask_ai_success(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test successfully enabling Ask AI for multiple domains."""
    with patch("fai.routes.settings.httpx.AsyncClient") as mock_client:
        # Mock successful reindex response
        from unittest.mock import Mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json = Mock(return_value={"job_id": "test-job-123"})

        mock_get = AsyncMock(return_value=mock_response)
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.get = mock_get
        mock_client.return_value = mock_context

        # Mock revalidate_domain background task
        with patch("fai.routes.settings.revalidate_domain"):
            response = test_client.post(
                "/settings/ask-ai/enable",
                json={
                    "domains": ["test1.docs.buildwithfern.com", "test2.docs.buildwithfern.com"],
                    "org_name": "test-org",
                    "locations": ["docs", "slack"]
                }
            )

    print(f"Response: {response.status_code}, {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify database records were created
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "test1.docs.buildwithfern.com"))
    record1 = result.scalar_one_or_none()
    assert record1 is not None
    assert record1.docs_enabled is True
    assert record1.slack_enabled is True
    assert record1.discord_enabled is False
    assert record1.job_id == "test-job-123"
    assert record1.org_name == "test-org"

    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "test2.docs.buildwithfern.com"))
    record2 = result.scalar_one_or_none()
    assert record2 is not None
    assert record2.docs_enabled is True
    assert record2.slack_enabled is True
    assert record2.discord_enabled is False


@pytest.mark.asyncio
async def test_enable_ask_ai_updates_existing_record(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test that enabling Ask AI updates an existing record."""
    # Create an existing record
    existing_record = SettingsDb(
        domain="existing.docs.buildwithfern.com",
        org_name="old-org",
        job_id=None,
        last_reindex_time=None,
        is_preview=True,
        docs_enabled=False,
        slack_enabled=False,
        discord_enabled=False,
    )
    test_session.add(existing_record)
    await test_session.commit()

    with patch("fai.routes.settings.httpx.AsyncClient") as mock_client:
        from unittest.mock import Mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json = Mock(return_value={"job_id": "new-job-456"})

        mock_get = AsyncMock(return_value=mock_response)
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.get = mock_get
        mock_client.return_value = mock_context

        with patch("fai.routes.settings.revalidate_domain"):
            response = test_client.post(
                "/settings/ask-ai/enable",
                json={
                    "domains": ["existing.docs.buildwithfern.com"],
                    "org_name": "new-org",
                    "locations": ["docs", "discord"]
                }
            )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify the record was updated
    await test_session.refresh(existing_record)
    assert existing_record.docs_enabled is True
    assert existing_record.slack_enabled is False
    assert existing_record.discord_enabled is True
    assert existing_record.job_id == "new-job-456"
    assert existing_record.org_name == "old-org"  # org_name should not change on update


@pytest.mark.asyncio
async def test_enable_ask_ai_no_locations(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test that enabling Ask AI with no locations skips the domain."""
    response = test_client.post(
        "/settings/ask-ai/enable",
        json={
            "domains": ["test.docs.buildwithfern.com"],
            "org_name": "test-org",
            "locations": []
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False

    # Verify no database record was created
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "test.docs.buildwithfern.com"))
    record = result.scalar_one_or_none()
    assert record is None


@pytest.mark.asyncio
async def test_enable_ask_ai_reindex_fails(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test that a failed reindex is handled gracefully."""
    with patch("fai.routes.settings.httpx.AsyncClient") as mock_client:
        # Mock failed reindex response
        from unittest.mock import Mock
        mock_response = Mock()
        mock_response.status_code = 500

        mock_get = AsyncMock(return_value=mock_response)
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.get = mock_get
        mock_client.return_value = mock_context

        response = test_client.post(
            "/settings/ask-ai/enable",
            json={
                "domains": ["test.docs.buildwithfern.com"],
                "org_name": "test-org",
                "locations": ["docs"]
            }
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False

    # Verify the database record was still created (but without job_id)
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "test.docs.buildwithfern.com"))
    record = result.scalar_one_or_none()
    assert record is not None
    assert record.docs_enabled is True
    assert record.job_id is None


@pytest.mark.asyncio
async def test_enable_ask_ai_partial_success(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test enabling Ask AI for multiple domains with partial success."""
    with patch("fai.routes.settings.httpx.AsyncClient") as mock_client:
        # First domain succeeds, second fails
        from unittest.mock import Mock
        mock_success = Mock()
        mock_success.status_code = 200
        mock_success.json = Mock(return_value={"job_id": "test-job-123"})

        mock_failure = Mock()
        mock_failure.status_code = 500

        mock_get = AsyncMock(side_effect=[mock_success, mock_failure])
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.get = mock_get
        mock_client.return_value = mock_context

        with patch("fai.routes.settings.revalidate_domain"):
            response = test_client.post(
                "/settings/ask-ai/enable",
                json={
                    "domains": ["success.docs.buildwithfern.com", "failure.docs.buildwithfern.com"],
                    "org_name": "test-org",
                    "locations": ["docs"]
                }
            )

    assert response.status_code == 200
    data = response.json()
    # Using all(), so partial success counts as failure
    assert data["success"] is False

    # Verify first domain was created successfully
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "success.docs.buildwithfern.com"))
    record1 = result.scalar_one_or_none()
    assert record1 is not None
    assert record1.job_id == "test-job-123"

    # Verify second domain was created but without job_id
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "failure.docs.buildwithfern.com"))
    record2 = result.scalar_one_or_none()
    assert record2 is not None
    assert record2.job_id is None


@pytest.mark.asyncio
async def test_enable_ask_ai_http_exception(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test that HTTP exceptions are handled gracefully."""
    with patch("fai.routes.settings.httpx.AsyncClient") as mock_client:
        # Mock HTTP exception
        mock_get = AsyncMock(side_effect=Exception("Network error"))
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.get = mock_get
        mock_client.return_value = mock_context

        response = test_client.post(
            "/settings/ask-ai/enable",
            json={
                "domains": ["test.docs.buildwithfern.com"],
                "org_name": "test-org",
                "locations": ["docs"]
            }
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False

    # Verify the database record was still created
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "test.docs.buildwithfern.com"))
    record = result.scalar_one_or_none()
    assert record is not None
    assert record.job_id is None
