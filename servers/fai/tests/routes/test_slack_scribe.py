from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

MOCK_ORGS = ["org-alpha", "org-beta"]


@pytest.fixture()
def scribe_test_client(test_client: TestClient) -> Generator[TestClient, None, None]:
    yield test_client  # type: ignore[misc]


def _mock_session_context():
    mock_integration = MagicMock()
    mock_integration.integration_id = "test-integration-id"

    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, "integration_id", "test-integration-id"))

    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=mock_session)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


class TestGetFernWriterInstallLink:
    @patch("fai.routes.slack_scribe.create_slack_integration_url", return_value="https://slack.com/install")
    @patch("fai.routes.slack_scribe.async_session_maker", side_effect=lambda: _mock_session_context())
    @patch(
        "fai.routes.slack_scribe.validate_scribe_github_repo_access",
        new_callable=AsyncMock,
        return_value={"ok": True},
    )
    @patch(
        "fai.routes.slack_scribe.verify_org_token",
        new_callable=AsyncMock,
        return_value=("test-token", MOCK_ORGS),
    )
    def test_uses_first_org_when_none_provided(
        self,
        mock_verify: AsyncMock,
        mock_validate: AsyncMock,
        mock_session: MagicMock,
        mock_install_url: MagicMock,
        scribe_test_client: TestClient,
    ) -> None:
        resp = scribe_test_client.get(
            "/scribe/slack/get-install",
            params={"github_repo": "owner/repo"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["github_repo"] == "owner/repo"
        assert body["integration_id"] == "test-integration-id"
        assert body["install_url"] == "https://slack.com/install"

    @patch("fai.routes.slack_scribe.create_slack_integration_url", return_value="https://slack.com/install")
    @patch("fai.routes.slack_scribe.async_session_maker", side_effect=lambda: _mock_session_context())
    @patch(
        "fai.routes.slack_scribe.validate_scribe_github_repo_access",
        new_callable=AsyncMock,
        return_value={"ok": True},
    )
    @patch(
        "fai.routes.slack_scribe.verify_org_token",
        new_callable=AsyncMock,
        return_value=("test-token", MOCK_ORGS),
    )
    def test_accepts_valid_org_id(
        self,
        mock_verify: AsyncMock,
        mock_validate: AsyncMock,
        mock_session: MagicMock,
        mock_install_url: MagicMock,
        scribe_test_client: TestClient,
    ) -> None:
        resp = scribe_test_client.get(
            "/scribe/slack/get-install",
            params={"github_repo": "owner/repo", "org_id": "org-beta"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["github_repo"] == "owner/repo"
        assert body["integration_id"] == "test-integration-id"

    @patch(
        "fai.routes.slack_scribe.validate_scribe_github_repo_access",
        new_callable=AsyncMock,
        return_value={"ok": True},
    )
    @patch(
        "fai.routes.slack_scribe.verify_org_token",
        new_callable=AsyncMock,
        return_value=("test-token", MOCK_ORGS),
    )
    def test_rejects_org_id_not_in_user_orgs(
        self, mock_verify: AsyncMock, mock_validate: AsyncMock, scribe_test_client: TestClient
    ) -> None:
        resp = scribe_test_client.get(
            "/scribe/slack/get-install",
            params={"github_repo": "owner/repo", "org_id": "org-unknown"},
        )
        assert resp.status_code == 403

    @patch(
        "fai.routes.slack_scribe.verify_org_token",
        new_callable=AsyncMock,
        return_value=("test-token", MOCK_ORGS),
    )
    def test_rejects_invalid_github_repo(self, mock_verify: AsyncMock, scribe_test_client: TestClient) -> None:
        with patch(
            "fai.routes.slack_scribe.validate_scribe_github_repo_access",
            new_callable=AsyncMock,
            return_value={
                "ok": False,
                "error": {"type": "not_found", "message": "Repo not found"},
            },
        ):
            resp = scribe_test_client.get(
                "/scribe/slack/get-install",
                params={"github_repo": "bad/repo"},
            )
            assert resp.status_code == 400
