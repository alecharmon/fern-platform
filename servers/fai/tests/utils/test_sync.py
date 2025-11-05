from datetime import (
    UTC,
    datetime,
)
from unittest.mock import (
    AsyncMock,
    MagicMock,
    patch,
)

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from fai.models.db.website_db import WebsiteDb
from fai.utils.turbopuffer.sync import (
    delete_websites_from_query_index,
    delete_websites_from_tpuf,
    sync_websites_to_query_index,
    sync_websites_to_tpuf,
)
from tests.factories import (
    create_test_domain,
    create_test_id,
)


class TestWebsiteSync:
    @pytest.mark.asyncio
    async def test_sync_websites_to_tpuf(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        website_ids = [create_test_id(), create_test_id(), create_test_id()]

        for website_id in website_ids:
            website = WebsiteDb(
                id=website_id,
                domain=domain,
                base_url="https://example.com/docs",
                page_url=f"https://example.com/docs/{website_id}",
                chunk=f"Test chunk {website_id}",
                document=f"Test document {website_id}",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            test_session.add(website)
        await test_session.commit()

        mock_tpuf_record = MagicMock()
        mock_namespace = AsyncMock()

        async def mock_to_tpuf_record(openai_client: AsyncMock) -> MagicMock:
            return mock_tpuf_record

        with (
            patch("fai.utils.turbopuffer.sync.AsyncOpenAI") as mock_openai_cls,
            patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls,
            patch.object(WebsiteDb, "to_tpuf_record", side_effect=mock_to_tpuf_record),
        ):
            mock_openai = AsyncMock()
            mock_tpuf_client = MagicMock()
            mock_tpuf_client.namespace = MagicMock(return_value=mock_namespace)

            mock_openai_cls.return_value.__aenter__.return_value = mock_openai
            mock_tpuf_cls.return_value.__aenter__.return_value = mock_tpuf_client

            await sync_websites_to_tpuf(domain, website_ids, test_session)

            mock_tpuf_client.namespace.assert_called_once()
            mock_namespace.write.assert_awaited_once()
            call_kwargs = mock_namespace.write.call_args[1]
            assert len(call_kwargs["upsert_rows"]) == 3
            assert call_kwargs["distance_metric"] == "cosine_distance"

    @pytest.mark.asyncio
    async def test_sync_websites_to_tpuf_empty_list(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        with (
            patch("fai.utils.turbopuffer.sync.AsyncOpenAI") as mock_openai_cls,
            patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls,
        ):
            await sync_websites_to_tpuf(domain, [], test_session)

            mock_openai_cls.assert_not_called()
            mock_tpuf_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_sync_websites_to_tpuf_not_found(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        non_existent_ids = [create_test_id(), create_test_id()]

        with (
            patch("fai.utils.turbopuffer.sync.AsyncOpenAI") as mock_openai_cls,
            patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls,
        ):
            await sync_websites_to_tpuf(domain, non_existent_ids, test_session)

            mock_openai_cls.assert_not_called()
            mock_tpuf_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_websites_from_tpuf(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        website_ids = [create_test_id(), create_test_id()]

        mock_namespace = AsyncMock()

        with patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls:
            mock_tpuf_client = MagicMock()
            mock_tpuf_client.namespace = MagicMock(return_value=mock_namespace)

            mock_tpuf_cls.return_value.__aenter__.return_value = mock_tpuf_client

            await delete_websites_from_tpuf(domain, website_ids)

            mock_tpuf_client.namespace.assert_called_once()
            assert mock_namespace.write.await_count == 2

    @pytest.mark.asyncio
    async def test_delete_websites_from_tpuf_empty_list(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        with patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls:
            await delete_websites_from_tpuf(domain, [])

            mock_tpuf_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_sync_websites_to_query_index(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        website_ids = [create_test_id(), create_test_id()]

        mock_source_ns = AsyncMock()
        mock_target_ns = AsyncMock()

        mock_row = MagicMock()
        mock_row.model_dump.return_value = {"id": "test-id", "vector": [0.1, 0.2], "attributes": {}}
        mock_result = MagicMock()
        mock_result.rows = [mock_row]
        mock_source_ns.query.return_value = mock_result

        with patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls:
            mock_tpuf_client = MagicMock()
            mock_tpuf_client.namespace = MagicMock(side_effect=[mock_source_ns, mock_target_ns])

            mock_tpuf_cls.return_value.__aenter__.return_value = mock_tpuf_client

            await sync_websites_to_query_index(domain, website_ids, "websites", "query")

            assert mock_source_ns.query.await_count == 2
            assert mock_target_ns.write.await_count == 3

    @pytest.mark.asyncio
    async def test_sync_websites_to_query_index_empty_list(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        with patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls:
            await sync_websites_to_query_index(domain, [], "websites", "query")

            mock_tpuf_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_sync_websites_to_query_index_no_rows_found(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        website_ids = [create_test_id()]

        mock_source_ns = AsyncMock()
        mock_target_ns = AsyncMock()

        mock_result = MagicMock()
        mock_result.rows = []
        mock_source_ns.query.return_value = mock_result

        with patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls:
            mock_tpuf_client = MagicMock()
            mock_tpuf_client.namespace = MagicMock(side_effect=[mock_source_ns, mock_target_ns])

            mock_tpuf_cls.return_value.__aenter__.return_value = mock_tpuf_client

            await sync_websites_to_query_index(domain, website_ids, "websites", "query")

            mock_source_ns.query.assert_awaited_once()
            assert mock_target_ns.write.await_count == 1

    @pytest.mark.asyncio
    async def test_delete_websites_from_query_index(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()
        website_ids = [create_test_id(), create_test_id()]

        mock_target_ns = AsyncMock()

        with patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls:
            mock_tpuf_client = MagicMock()
            mock_tpuf_client.namespace = MagicMock(return_value=mock_target_ns)

            mock_tpuf_cls.return_value.__aenter__.return_value = mock_tpuf_client

            await delete_websites_from_query_index(domain, website_ids, "websites", "query")

            mock_tpuf_client.namespace.assert_called_once()
            assert mock_target_ns.write.await_count == 2

    @pytest.mark.asyncio
    async def test_delete_websites_from_query_index_empty_list(self, test_session: AsyncSession) -> None:
        domain = create_test_domain()

        with patch("fai.utils.turbopuffer.sync.AsyncTurbopuffer") as mock_tpuf_cls:
            await delete_websites_from_query_index(domain, [], "websites", "query")

            mock_tpuf_cls.assert_not_called()
