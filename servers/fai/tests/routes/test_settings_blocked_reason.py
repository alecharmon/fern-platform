from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.settings_db import SettingsDb


def _make_credit_result(allowed: bool) -> MagicMock:
    result = MagicMock()
    result.allowed = allowed
    return result


@pytest.mark.asyncio
async def test_blocked_reason_credits_exhausted(test_client: TestClient, test_session: AsyncSession) -> None:
    record = SettingsDb(
        domain="gated.docs.buildwithfern.com",
        basepath="",
        org_name="gated-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    mock_client = AsyncMock()
    mock_client.check_credits.return_value = _make_credit_result(allowed=False)

    with (
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
        patch("fai.routes.settings.has_completed_reindex", return_value=True),
        patch("fai.routes.settings.get_credit_client", return_value=mock_client),
        patch("fai.routes.settings.is_credit_gated", return_value=True),
    ):
        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "gated.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is True
    assert data["ask_ai_blocked_reason"] == "credits_exhausted"


@pytest.mark.asyncio
async def test_blocked_reason_none_when_credits_allowed(test_client: TestClient, test_session: AsyncSession) -> None:
    record = SettingsDb(
        domain="allowed.docs.buildwithfern.com",
        basepath="",
        org_name="allowed-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    mock_client = AsyncMock()
    mock_client.check_credits.return_value = _make_credit_result(allowed=True)

    with (
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
        patch("fai.routes.settings.has_completed_reindex", return_value=True),
        patch("fai.routes.settings.get_credit_client", return_value=mock_client),
        patch("fai.routes.settings.is_credit_gated", return_value=True),
    ):
        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "allowed.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is True
    assert data["ask_ai_blocked_reason"] is None


@pytest.mark.asyncio
async def test_blocked_reason_none_when_docs_disabled(test_client: TestClient, test_session: AsyncSession) -> None:
    record = SettingsDb(
        domain="disabled-credits.docs.buildwithfern.com",
        basepath="",
        org_name="disabled-org",
        docs_enabled=False,
    )
    test_session.add(record)
    await test_session.commit()

    mock_client = AsyncMock()
    mock_client.check_credits.return_value = _make_credit_result(allowed=False)

    with (
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
        patch("fai.routes.settings.has_completed_reindex", return_value=True),
        patch("fai.routes.settings.get_credit_client", return_value=mock_client),
        patch("fai.routes.settings.is_credit_gated", return_value=True),
    ):
        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "disabled-credits.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is False
    assert data["ask_ai_blocked_reason"] is None
    mock_client.check_credits.assert_not_called()


@pytest.mark.asyncio
async def test_blocked_reason_none_on_credit_check_exception(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    record = SettingsDb(
        domain="error.docs.buildwithfern.com",
        basepath="",
        org_name="error-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    mock_client = AsyncMock()
    mock_client.check_credits.side_effect = Exception("Network timeout")

    with (
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
        patch("fai.routes.settings.has_completed_reindex", return_value=True),
        patch("fai.routes.settings.get_credit_client", return_value=mock_client),
        patch("fai.routes.settings.is_credit_gated", return_value=True),
    ):
        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "error.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is True
    assert data["ask_ai_blocked_reason"] is None


@pytest.mark.asyncio
async def test_blocked_reason_none_when_credit_client_not_configured(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    record = SettingsDb(
        domain="noclient.docs.buildwithfern.com",
        basepath="",
        org_name="noclient-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    with (
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
        patch("fai.routes.settings.has_completed_reindex", return_value=True),
        patch("fai.routes.settings.get_credit_client", return_value=None),
    ):
        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "noclient.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is True
    assert data["ask_ai_blocked_reason"] is None


@pytest.mark.asyncio
async def test_blocked_reason_none_when_org_not_credit_gated(
    test_client: TestClient, test_session: AsyncSession
) -> None:
    record = SettingsDb(
        domain="ungated.docs.buildwithfern.com",
        basepath="",
        org_name="ungated-org",
        docs_enabled=True,
    )
    test_session.add(record)
    await test_session.commit()

    mock_client = AsyncMock()

    with (
        patch("fai.routes.settings.is_basepath_aware", return_value=False),
        patch("fai.routes.settings.has_completed_reindex", return_value=True),
        patch("fai.routes.settings.get_credit_client", return_value=mock_client),
        patch("fai.routes.settings.is_credit_gated", return_value=False),
    ):
        response = test_client.get(
            "/settings/ask-ai/docs",
            params={"domain": "ungated.docs.buildwithfern.com"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ask_ai_enabled"] is True
    assert data["ask_ai_blocked_reason"] is None
    mock_client.check_credits.assert_not_called()
