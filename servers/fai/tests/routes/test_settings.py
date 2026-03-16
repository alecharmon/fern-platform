from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.settings_db import SettingsDb


@pytest.mark.asyncio
async def test_enable_ask_ai_success(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test successfully enabling Ask AI for multiple domains."""
    with patch("fai.routes.settings.queue_reindex_sqs") as mock_queue_reindex:
        # Mock successful SQS queue response
        mock_queue_reindex.return_value = "test-job-123"

        # Mock revalidate_domain background task
        with patch("fai.routes.settings.revalidate_domain"):
            response = test_client.post(
                "/settings/ask-ai/enable",
                json={
                    "domains": ["test1.docs.buildwithfern.com", "test2.docs.buildwithfern.com"],
                    "org_name": "test-org",
                    "locations": ["docs", "slack"],
                },
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
        last_reindex_time=None,
        is_preview=True,
        docs_enabled=False,
        slack_enabled=False,
        discord_enabled=False,
    )
    test_session.add(existing_record)
    await test_session.commit()

    with patch("fai.routes.settings.queue_reindex_sqs") as mock_queue_reindex:
        # Mock successful SQS queue response
        mock_queue_reindex.return_value = "new-job-456"

        with patch("fai.routes.settings.revalidate_domain"):
            response = test_client.post(
                "/settings/ask-ai/enable",
                json={
                    "domains": ["existing.docs.buildwithfern.com"],
                    "org_name": "new-org",
                    "locations": ["docs", "discord"],
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify the record was updated
    await test_session.refresh(existing_record)
    assert existing_record.docs_enabled is True
    assert existing_record.slack_enabled is False
    assert existing_record.discord_enabled is True
    assert existing_record.org_name == "old-org"  # org_name should not change on update


@pytest.mark.asyncio
async def test_enable_ask_ai_no_locations(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test that enabling Ask AI with no locations skips the domain."""
    response = test_client.post(
        "/settings/ask-ai/enable",
        json={"domains": ["test.docs.buildwithfern.com"], "org_name": "test-org", "locations": []},
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
    with patch("fai.routes.settings.queue_reindex_sqs") as mock_queue_reindex:
        # Mock failed SQS queue
        mock_queue_reindex.side_effect = Exception("SQS connection failed")

        response = test_client.post(
            "/settings/ask-ai/enable",
            json={"domains": ["test.docs.buildwithfern.com"], "org_name": "test-org", "locations": ["docs"]},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False

    # Verify the database record was still created
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "test.docs.buildwithfern.com"))
    record = result.scalar_one_or_none()
    assert record is not None
    assert record.docs_enabled is True


@pytest.mark.asyncio
async def test_enable_ask_ai_partial_success(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test enabling Ask AI for multiple domains with partial success."""
    with patch("fai.routes.settings.queue_reindex_sqs") as mock_queue_reindex:
        # First domain succeeds, second fails
        mock_queue_reindex.side_effect = ["test-job-123", Exception("SQS error")]

        with patch("fai.routes.settings.revalidate_domain"):
            response = test_client.post(
                "/settings/ask-ai/enable",
                json={
                    "domains": ["success.docs.buildwithfern.com", "failure.docs.buildwithfern.com"],
                    "org_name": "test-org",
                    "locations": ["docs"],
                },
            )

    assert response.status_code == 200
    data = response.json()
    # Using all(), so partial success counts as failure
    assert data["success"] is False

    # Verify first domain was created successfully
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "success.docs.buildwithfern.com"))
    record1 = result.scalar_one_or_none()
    assert record1 is not None

    # Verify second domain was also created
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "failure.docs.buildwithfern.com"))
    record2 = result.scalar_one_or_none()
    assert record2 is not None


@pytest.mark.asyncio
async def test_enable_ask_ai_http_exception(test_client: TestClient, test_session: AsyncSession) -> None:
    """Test that SQS exceptions are handled gracefully."""
    with patch("fai.routes.settings.queue_reindex_sqs") as mock_queue_reindex:
        # Mock SQS exception
        mock_queue_reindex.side_effect = Exception("Network error")

        response = test_client.post(
            "/settings/ask-ai/enable",
            json={"domains": ["test.docs.buildwithfern.com"], "org_name": "test-org", "locations": ["docs"]},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False

    # Verify the database record was still created
    result = await test_session.execute(select(SettingsDb).where(SettingsDb.domain == "test.docs.buildwithfern.com"))
    record = result.scalar_one_or_none()
    assert record is not None


# ── /settings/ask-ai/reindex basepath tests ──────────────────────────────────


@pytest.mark.asyncio
async def test_reindex_uses_explicit_basepath(test_client: TestClient, test_session: AsyncSession) -> None:
    """Reindex endpoint should use the explicit basepath query param to find the settings record."""
    record = SettingsDb(
        domain="fruits.docs.buildwithfern.com",
        basepath="/apple",
        org_name="test-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    with (
        patch("fai.routes.settings.queue_reindex_sqs", return_value="job-1"),
        patch("fai.routes.settings.is_basepath_aware", return_value=True),
    ):
        response = test_client.post(
            "/settings/ask-ai/reindex",
            params={
                "domain": "fruits.docs.buildwithfern.com",
                "basepath": "/apple",
                "force_full_reindex": "true",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["ask_ai_enabled"] is True
    assert data["job_id"] is not None


@pytest.mark.asyncio
async def test_reindex_parses_basepath_from_domain_url(test_client: TestClient, test_session: AsyncSession) -> None:
    """When no explicit basepath is given, reindex should parse it from the domain URL."""
    record = SettingsDb(
        domain="veggies.docs.buildwithfern.com",
        basepath="/carrot",
        org_name="test-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    with (
        patch("fai.routes.settings.queue_reindex_sqs", return_value="job-2"),
        patch("fai.routes.settings.is_basepath_aware", return_value=True),
    ):
        # Pass the basepath inside the domain URL, no explicit basepath param
        response = test_client.post(
            "/settings/ask-ai/reindex",
            params={
                "domain": "veggies.docs.buildwithfern.com/carrot",
                "force_full_reindex": "true",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["ask_ai_enabled"] is True


@pytest.mark.asyncio
async def test_reindex_explicit_basepath_overrides_parsed(test_client: TestClient, test_session: AsyncSession) -> None:
    """Explicit basepath param should take precedence over the one parsed from domain."""
    record = SettingsDb(
        domain="veggies2.docs.buildwithfern.com",
        basepath="/cherry",
        org_name="test-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    with (
        patch("fai.routes.settings.queue_reindex_sqs", return_value="job-3"),
        patch("fai.routes.settings.is_basepath_aware", return_value=True),
    ):
        # domain URL has /apple but explicit basepath is /cherry
        response = test_client.post(
            "/settings/ask-ai/reindex",
            params={
                "domain": "veggies2.docs.buildwithfern.com/apple",
                "basepath": "/cherry",
                "force_full_reindex": "true",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["ask_ai_enabled"] is True


# ── /settings/ask-ai/docs is_initially_indexing tests ────────────────────────


@pytest.mark.asyncio
async def test_get_docs_settings_initially_indexing_false_when_queue_fails(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    """is_initially_indexing should be False when reindex queue fails during auto-provision."""
    with (
        patch("fai.routes.settings.resolve_domain_metadata") as mock_meta,
        patch("fai.routes.settings.queue_reindex_sqs", side_effect=Exception("SQS down")),
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
    ):
        from fai.dependencies import DomainMetadata

        mock_meta.return_value = DomainMetadata(org_id="test-org", is_preview=False)

        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "newsite.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is True
    assert data["is_initially_indexing"] is False  # queue failed, not actually indexing


@pytest.mark.asyncio
async def test_get_docs_settings_initially_indexing_true_when_queue_succeeds(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    """is_initially_indexing should be True when reindex queue succeeds during auto-provision."""
    with (
        patch("fai.routes.settings.resolve_domain_metadata") as mock_meta,
        patch("fai.routes.settings.queue_reindex_sqs", return_value="job-ok"),
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
    ):
        from fai.dependencies import DomainMetadata

        mock_meta.return_value = DomainMetadata(org_id="test-org", is_preview=False)

        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "newsite2.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is True
    assert data["is_initially_indexing"] is True


# ── /reindex and /toggle/status consistency tests ────────────────────────────


@pytest.mark.asyncio
async def test_reindex_and_toggle_status_consistent_for_non_basepath_domain(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    """Both /reindex and /toggle/status should return ask_ai_enabled=True for a non-basepath domain with docs_enabled=True."""
    record = SettingsDb(
        domain="frame-io.docs.buildwithfern.com",
        basepath="",
        org_name="frame-io",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    with (
        patch("fai.routes.settings.queue_reindex_sqs", return_value="job-4"),
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
    ):
        reindex_resp = test_client.post(
            "/settings/ask-ai/reindex",
            params={"domain": "frame-io.docs.buildwithfern.com", "force_full_reindex": "true"},
        )

    with patch("fai.routes.settings.is_basepath_aware", return_value=False):
        toggle_resp = test_client.get(
            "/settings/ask-ai/toggle/status",
            params={"domain": "frame-io.docs.buildwithfern.com"},
        )

    assert reindex_resp.status_code == 200
    assert toggle_resp.status_code == 200
    assert reindex_resp.json()["ask_ai_enabled"] is True
    assert toggle_resp.json()["ask_ai_enabled"] is True


@pytest.mark.asyncio
async def test_reindex_returns_docs_enabled_false_when_disabled(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    """Both endpoints should return ask_ai_enabled=False when docs_enabled is explicitly False."""
    record = SettingsDb(
        domain="disabled.docs.buildwithfern.com",
        basepath="",
        org_name="test-org",
        docs_enabled=False,
    )
    test_session.add(record)
    await test_session.commit()

    with (
        patch("fai.routes.settings.queue_reindex_sqs", return_value="job-5"),
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
    ):
        reindex_resp = test_client.post(
            "/settings/ask-ai/reindex",
            params={"domain": "disabled.docs.buildwithfern.com", "force_full_reindex": "true"},
        )

    with patch("fai.routes.settings.is_basepath_aware", return_value=False):
        toggle_resp = test_client.get(
            "/settings/ask-ai/toggle/status",
            params={"domain": "disabled.docs.buildwithfern.com"},
        )

    assert reindex_resp.status_code == 200
    assert toggle_resp.status_code == 200
    assert reindex_resp.json()["ask_ai_enabled"] is False
    assert toggle_resp.json()["ask_ai_enabled"] is False


@pytest.mark.asyncio
async def test_reindex_auto_provision_failure_defaults_to_enabled(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    """When auto-provisioning fails in /reindex, ask_ai_enabled should default to True (consistent with /toggle/status no-record default)."""
    with (
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
        patch("fai.routes.settings.resolve_org_id", side_effect=Exception("org resolution failed")),
    ):
        reindex_resp = test_client.post(
            "/settings/ask-ai/reindex",
            params={"domain": "unknown.docs.buildwithfern.com", "force_full_reindex": "true"},
        )

    with patch("fai.routes.settings.is_basepath_aware", return_value=False):
        toggle_resp = test_client.get(
            "/settings/ask-ai/toggle/status",
            params={"domain": "unknown.docs.buildwithfern.com"},
        )

    assert reindex_resp.status_code == 200
    assert toggle_resp.status_code == 200
    # Both should default to True when no record exists
    assert reindex_resp.json()["ask_ai_enabled"] is True
    assert toggle_resp.json()["ask_ai_enabled"] is True
