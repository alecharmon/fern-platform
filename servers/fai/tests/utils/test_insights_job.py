from datetime import (
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

from src.fai.models.db.insight_db import InsightDb
from src.fai.models.db.query_db import QueryDb
from src.fai.utils.insights_job import (
    generate_insight_id,
    generate_insights_for_all_domains,
    generate_insights_for_domain,
    get_domains_with_recent_queries,
)


@pytest.mark.asyncio
async def test_generate_insight_id() -> None:
    """Test insight ID generation."""
    domain = "test.com"
    date = datetime(2024, 1, 1, 0, 0, 0)

    id1 = generate_insight_id(domain, date)
    id2 = generate_insight_id(domain, date)
    id3 = generate_insight_id("other.com", date)

    assert id1 == id2
    assert len(id1) == 16

    assert id1 != id3


@pytest.mark.asyncio
async def test_get_domains_with_recent_queries() -> None:
    """Test getting domains with recent queries."""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["domain1.com", "domain2.com"]
    mock_db.execute.return_value = mock_result

    start = datetime.now() - timedelta(days=7)
    end = datetime.now()

    domains = await get_domains_with_recent_queries(mock_db, start, end)

    assert domains == ["domain1.com", "domain2.com"]
    mock_db.execute.assert_called_once()


@pytest.mark.asyncio
async def test_generate_insights_for_domain_cached() -> None:
    """Test generating insights when already cached."""
    mock_db = AsyncMock(spec=AsyncSession)

    mock_result = MagicMock()
    mock_insight = MagicMock(spec=InsightDb)
    mock_result.scalar_one_or_none.return_value = mock_insight
    mock_db.execute.return_value = mock_result

    domain = "test.com"
    start = datetime.now() - timedelta(days=7)
    end = datetime.now()

    result = await generate_insights_for_domain(mock_db, domain, start, end)

    assert result == (domain, True, "Insights already cached")
    mock_db.add.assert_not_called()
    mock_db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_generate_insights_for_domain_insufficient_queries() -> None:
    """Test generating insights with insufficient queries."""
    mock_db = AsyncMock(spec=AsyncSession)

    mock_cache_result = MagicMock()
    mock_cache_result.scalar_one_or_none.return_value = None

    mock_query_result = MagicMock()
    mock_queries = [MagicMock(spec=QueryDb) for _ in range(2)]
    for q in mock_queries:
        q.to_api.return_value = MagicMock(text="short")
    mock_query_result.scalars.return_value.all.return_value = mock_queries

    mock_db.execute.side_effect = [mock_cache_result, mock_query_result]

    domain = "test.com"
    start = datetime.now() - timedelta(days=7)
    end = datetime.now()

    with patch("src.fai.utils.insights_job.CONFIG.MIN_INSIGHTS_QUERIES", 10):
        result = await generate_insights_for_domain(mock_db, domain, start, end)

    assert result[0] == domain
    assert result[1] is False
    assert "Not enough queries" in result[2]


@pytest.mark.asyncio
async def test_generate_insights_for_all_domains() -> None:
    """Test generating insights for all domains."""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch("src.fai.utils.insights_job.get_domains_with_recent_queries") as mock_get_domains:
        with patch("src.fai.utils.insights_job.generate_insights_for_domain") as mock_generate:
            mock_get_domains.return_value = ["domain1.com", "domain2.com"]
            mock_generate.side_effect = [
                ("domain1.com", True, "Generated successfully"),
                ("domain2.com", False, "Not enough queries"),
            ]

            results = await generate_insights_for_all_domains(mock_db)

            assert results["total_domains"] == 2
            assert results["successful"] == 1
            assert results["failed"] == 1
            assert len(results["results"]) == 2
            assert results["results"][0]["success"] is True
            assert results["results"][1]["success"] is False


@pytest.mark.asyncio
async def test_generate_insights_for_all_domains_no_domains() -> None:
    """Test generating insights when no domains found."""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch("src.fai.utils.insights_job.get_domains_with_recent_queries") as mock_get_domains:
        mock_get_domains.return_value = []

        results = await generate_insights_for_all_domains(mock_db)

        assert results["total_domains"] == 0
        assert results["successful"] == 0
        assert results["failed"] == 0
        assert results["results"] == []
