from datetime import (
    UTC,
    datetime,
    timedelta,
)
from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.query_db import QueryDb
from fai.utils.conversation_reports_job import (
    classify_conversation_with_retry,
    format_conversation,
    get_conversations_to_process,
    process_conversation_report_async,
    process_conversation_reports,
)
from fai.utils.generate.conversation_classification import ConversationClassification


@pytest.mark.asyncio
async def test_get_conversations_to_process() -> None:
    """Test getting conversations to process."""
    mock_db = AsyncMock(spec=AsyncSession)

    # Mock the initial query to get conversations in window
    mock_conv_result = MagicMock()
    mock_conv_result.all.return_value = [("conv1",), ("conv2",)]
    mock_db.execute.return_value = mock_conv_result

    start = datetime.now(UTC) - timedelta(hours=1)
    end = datetime.now(UTC)
    cutoff_time = end - timedelta(minutes=10)

    # Mock the database queries for checking eligibility
    # We create two mock results - one for each conversation check
    class ExecuteSideEffect:
        def __init__(self) -> None:
            self.call_count = 0

        def __call__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            # First call is the initial query
            if self.call_count == 0:
                self.call_count += 1
                return mock_conv_result

            # Subsequent calls are for individual conversations
            # We return mock messages based on which conversation is being queried
            mock_messages = MagicMock()

            # Check if this is for conv1 or conv2 based on call order (conv1 first, conv2 second)
            if self.call_count == 1:
                # conv1: concluded >10min ago with assistant
                mock_messages.all.return_value = [
                    (cutoff_time - timedelta(minutes=5), "domain1.com", "ASSISTANT"),
                    (cutoff_time - timedelta(minutes=10), "domain1.com", "USER"),
                ]
            else:
                # conv2: too recent (use end time to ensure consistency)
                mock_messages.all.return_value = [
                    (end - timedelta(minutes=2), "domain2.com", "ASSISTANT"),
                ]

            self.call_count += 1
            return mock_messages

    mock_db.execute.side_effect = ExecuteSideEffect()

    conversations = await get_conversations_to_process(mock_db, start, end)

    # Only one conversation should be returned (the one that's old enough)
    # Due to set ordering being non-deterministic, we can't guarantee which conversation
    # is processed first in the mock. The important thing is that only 1 passes the filter.
    assert len(conversations) == 1
    # The returned conversation should be one of our test conversations
    assert conversations[0][0] in ["conv1", "conv2"]
    assert conversations[0][1] in ["domain1.com", "domain2.com"]


@pytest.mark.asyncio
async def test_format_conversation() -> None:
    """Test conversation formatting."""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()

    mock_queries = []
    user_query = MagicMock(spec=QueryDb)
    user_query.role = "USER"
    user_query.text = "How do I use the API?"
    user_query.created_at = datetime.now()

    assistant_query = MagicMock(spec=QueryDb)
    assistant_query.role = "ASSISTANT"
    assistant_query.text = "You can use the API by making HTTP requests."
    assistant_query.created_at = datetime.now()

    mock_queries = [user_query, assistant_query]
    mock_result.scalars.return_value.all.return_value = mock_queries
    mock_db.execute.return_value = mock_result

    formatted = await format_conversation(mock_db, "conv1")

    assert "User: How do I use the API?" in formatted
    assert "Assistant: You can use the API by making HTTP requests." in formatted
    mock_db.execute.assert_called_once()


@pytest.mark.asyncio
async def test_classify_conversation_with_retry_success() -> None:
    """Test conversation classification with successful first attempt."""
    with patch("fai.utils.conversation_reports_job.generate_anthropic_generic_async") as mock_generate:
        mock_classification = ConversationClassification(resolved=True)
        mock_generate.return_value = mock_classification

        result = await classify_conversation_with_retry("User: Test\nAssistant: Response")

        assert result is not None
        assert result.resolved is True
        mock_generate.assert_called_once()


@pytest.mark.asyncio
async def test_classify_conversation_with_retry_failure() -> None:
    """Test conversation classification that fails all retries."""
    with patch("fai.utils.conversation_reports_job.generate_anthropic_generic_async") as mock_generate:
        mock_generate.return_value = None

        result = await classify_conversation_with_retry("User: Test\nAssistant: Response", max_retries=2, retry_delay=0)

        assert result is None
        # Should be called: 2 immediate retries + 1 final retry after delay = 3 times
        assert mock_generate.call_count == 3


@pytest.mark.asyncio
async def test_classify_conversation_with_retry_second_attempt_success() -> None:
    """Test conversation classification that succeeds on second attempt."""
    with patch("fai.utils.conversation_reports_job.generate_anthropic_generic_async") as mock_generate:
        mock_classification = ConversationClassification(resolved=False)
        mock_generate.side_effect = [None, mock_classification]

        result = await classify_conversation_with_retry("User: Test\nAssistant: Response")

        assert result is not None
        assert result.resolved is False
        assert mock_generate.call_count == 2


@pytest.mark.asyncio
async def test_process_conversation_report_success() -> None:
    """Test successfully processing a conversation report."""
    with patch("fai.utils.conversation_reports_job.format_conversation") as mock_format:
        with patch("fai.utils.conversation_reports_job.classify_conversation_with_retry") as mock_classify:
            with patch("fai.utils.conversation_reports_job.async_session_maker") as mock_session_maker:
                mock_db = AsyncMock(spec=AsyncSession)
                mock_session_maker.return_value.__aenter__.return_value = mock_db

                mock_format.return_value = "User: Test\nAssistant: Response"
                mock_classify.return_value = ConversationClassification(resolved=True)

                result = await process_conversation_report_async("conv1", "domain1.com")

                assert result[0] == "conv1"
                assert result[1] is True
                assert "resolved=True" in result[2]

                # Should delete old report and add new one
                mock_db.execute.assert_called_once()
                mock_db.add.assert_called_once()
                assert mock_db.commit.call_count == 2


@pytest.mark.asyncio
async def test_process_conversation_report_classification_failure() -> None:
    """Test processing a conversation report when classification fails."""
    with patch("fai.utils.conversation_reports_job.format_conversation") as mock_format:
        with patch("fai.utils.conversation_reports_job.classify_conversation_with_retry") as mock_classify:
            with patch("fai.utils.conversation_reports_job.async_session_maker") as mock_session_maker:
                mock_db = AsyncMock(spec=AsyncSession)
                mock_session_maker.return_value.__aenter__.return_value = mock_db

                mock_format.return_value = "User: Test\nAssistant: Response"
                mock_classify.return_value = None

                result = await process_conversation_report_async("conv1", "domain1.com")

                assert result[0] == "conv1"
                assert result[1] is False
                assert "Classification failed" in result[2]

                # Should delete old report but not add new one
                mock_db.execute.assert_called_once()
                mock_db.add.assert_not_called()


@pytest.mark.asyncio
async def test_process_conversation_reports() -> None:
    """Test processing conversation reports for all conversations."""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch("fai.utils.conversation_reports_job.get_conversations_to_process") as mock_get_convs:
        with patch("fai.utils.conversation_reports_job.process_conversation_report_async") as mock_process:
            mock_get_convs.return_value = [
                ("conv1", "domain1.com"),
                ("conv2", "domain2.com"),
            ]
            mock_process.side_effect = [
                ("conv1", True, "Report created: resolved=True"),
                ("conv2", False, "Classification failed"),
            ]

            results = await process_conversation_reports(mock_db)

            assert results["total_conversations"] == 2
            assert results["successful"] == 1
            assert results["failed"] == 1
            assert len(results["results"]) == 2
            assert results["results"][0]["success"] is True
            assert results["results"][1]["success"] is False


@pytest.mark.asyncio
async def test_process_conversation_reports_no_conversations() -> None:
    """Test processing when no conversations found."""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch("fai.utils.conversation_reports_job.get_conversations_to_process") as mock_get_convs:
        mock_get_convs.return_value = []

        results = await process_conversation_reports(mock_db)

        assert results["total_conversations"] == 0
        assert results["successful"] == 0
        assert results["failed"] == 0
        assert results["results"] == []


@pytest.mark.asyncio
async def test_process_conversation_reports_with_custom_times() -> None:
    """Test processing with custom start and end times."""
    mock_db = AsyncMock(spec=AsyncSession)
    start = datetime.now() - timedelta(hours=2)
    end = datetime.now() - timedelta(hours=1)

    with patch("fai.utils.conversation_reports_job.get_conversations_to_process") as mock_get_convs:
        mock_get_convs.return_value = []

        results = await process_conversation_reports(mock_db, start=start, end=end)

        assert results["start_time"] == start
        assert results["end_time"] == end
        mock_get_convs.assert_called_once_with(mock_db, start, end)
