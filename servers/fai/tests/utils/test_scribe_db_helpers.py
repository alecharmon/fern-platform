from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb


@pytest.fixture
def mock_integration() -> ScribeIntegrationDb:
    integration = MagicMock(spec=ScribeIntegrationDb)
    integration.integration_id = "int-123"
    integration.slack_team_id = "T0123456789"
    integration.slack_team_name = "Test Workspace"
    integration.github_repo = "test-org/test-repo"
    return integration


@pytest.fixture
def mock_session_record() -> ScribeSessionDb:
    session = MagicMock(spec=ScribeSessionDb)
    session.id = "sess-456"
    session.integration_id = "int-123"
    session.devin_session_id = "devin-789"
    session.slack_channel = "C0123456789"
    session.slack_thread_ts = "1234567890.123456"
    session.status = "running"
    return session


class TestGetScribeIntegrationByTeamId:
    @pytest.mark.asyncio
    async def test_returns_integration_when_found(self, mock_integration: ScribeIntegrationDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_integration_by_team_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_integration
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            result = await get_scribe_integration_by_team_id("T0123456789")

            assert result == mock_integration
            mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_integration_by_team_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            result = await get_scribe_integration_by_team_id("T_NONEXISTENT")

            assert result is None

    @pytest.mark.asyncio
    async def test_queries_with_correct_team_id(self, mock_integration: ScribeIntegrationDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_integration_by_team_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_integration
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            await get_scribe_integration_by_team_id("T0123456789")

            call_args = mock_session.execute.call_args[0][0]
            assert "slack_team_id" in str(call_args)


class TestGetScribeIntegrationById:
    @pytest.mark.asyncio
    async def test_returns_integration_when_found(self, mock_integration: ScribeIntegrationDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_integration_by_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_integration
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            result = await get_scribe_integration_by_id("int-123")

            assert result == mock_integration
            mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_integration_by_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            result = await get_scribe_integration_by_id("nonexistent")

            assert result is None

    @pytest.mark.asyncio
    async def test_queries_with_correct_integration_id(self, mock_integration: ScribeIntegrationDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_integration_by_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_integration
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            await get_scribe_integration_by_id("int-123")

            call_args = mock_session.execute.call_args[0][0]
            assert "integration_id" in str(call_args)


class TestGetScribeSessionById:
    @pytest.mark.asyncio
    async def test_returns_session_when_found_without_db(self, mock_session_record: ScribeSessionDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_session_by_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_session_record
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            result = await get_scribe_session_by_id("sess-456")

            assert result == mock_session_record
            mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found_without_db(self) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_session_by_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            result = await get_scribe_session_by_id("nonexistent")

            assert result is None

    @pytest.mark.asyncio
    async def test_uses_provided_db_session(self, mock_session_record: ScribeSessionDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_session_by_id

        provided_session = AsyncMock(spec=AsyncSession)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_session_record
        provided_session.execute = AsyncMock(return_value=mock_result)

        result = await get_scribe_session_by_id("sess-456", db=provided_session)

        assert result == mock_session_record
        provided_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_creates_new_session_when_db_not_provided(self, mock_session_record: ScribeSessionDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_session_by_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_session_record
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            result = await get_scribe_session_by_id("sess-456", db=None)

            assert result == mock_session_record
            mock_session.__aenter__.assert_called_once()

    @pytest.mark.asyncio
    async def test_queries_with_correct_session_id(self, mock_session_record: ScribeSessionDb) -> None:
        from fai.utils.scribe.db_helpers import get_scribe_session_by_id

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_session_record
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch("fai.utils.scribe.db_helpers.async_session_maker", return_value=mock_session):
            await get_scribe_session_by_id("sess-456")

            call_args = mock_session.execute.call_args[0][0]
            assert "id" in str(call_args) or "session" in str(call_args).lower()
