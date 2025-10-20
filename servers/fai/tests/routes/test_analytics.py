from datetime import (
    datetime,
    timedelta,
)
from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient

from fai.jobs.insights_job import generate_insight_id
from fai.models.db.insight_db import InsightDb
from tests.conftest import TEST_FERN_TOKEN
from tests.factories import create_test_domain


class TestAnalyticsHistogram:
    def test_get_analytics_histogram_success(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        mock_histogram_data = [
            {
                "label": "2024-01-01",
                "queryCount": 10,
                "conversationCount": 5,
                "conversationsPositiveCount": 3,
                "conversationsNegativeCount": 1,
            }
        ]

        with patch("fai.routes.analytics.fetch_grouped_data") as mock_fetch, patch(
            "fai.routes.analytics.fill_date_gaps"
        ) as mock_fill:
            mock_fetch.return_value = []
            mock_fill.return_value = mock_histogram_data

            response = test_client.get(
                f"/analytics/histogram/{domain}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
            )

            assert response.status_code == 200
            data = response.json()
            assert "bars" in data
            assert data["bars"] == mock_histogram_data

    def test_get_analytics_histogram_with_params(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        start_date = datetime.now() - timedelta(days=7)
        end_date = datetime.now()

        mock_histogram_data = [
            {
                "label": "2024-W01",
                "queryCount": 5,
                "conversationCount": 3,
                "conversationsPositiveCount": 2,
                "conversationsNegativeCount": 1,
            }
        ]

        with patch("fai.routes.analytics.fetch_grouped_data") as mock_fetch, patch(
            "fai.routes.analytics.fill_date_gaps"
        ) as mock_fill:
            mock_fetch.return_value = []
            mock_fill.return_value = mock_histogram_data

            response = test_client.get(
                f"/analytics/histogram/{domain}",
                params={"start_date": start_date.isoformat(), "end_date": end_date.isoformat(), "group_by": "WEEK"},
                headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "bars" in data

    def test_get_analytics_histogram_invalid_group_by(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        response = test_client.get(
            f"/analytics/histogram/{domain}",
            params={"group_by": "INVALID"},
            headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"},
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_get_analytics_histogram_failure(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        with patch("fai.routes.analytics.fetch_grouped_data") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            response = test_client.get(
                f"/analytics/histogram/{domain}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
            )

            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert data["detail"] == "Database error"


class TestAnalyticsInsights:
    def test_get_analytics_insights_success(self, test_client: TestClient, test_session: Any) -> None:
        """Test that the endpoint returns insights when they exist"""
        domain = create_test_domain()
        started_at = datetime.now() - timedelta(days=7)
        ended_at = datetime.now()

        # Create a mock insight record
        insight_id = generate_insight_id(domain, started_at)
        mock_insights_data = {
            "insights": [
                {
                    "insightText": "Users are asking about authentication",
                    "numberOfQueries": 15,
                    "examples": [
                        {"query": "How do I authenticate?", "conversationId": "conv-1"},
                        {"query": "What is the auth flow?", "conversationId": "conv-2"},
                    ],
                }
            ]
        }

        insight_record = InsightDb(
            insight_id=insight_id,
            domain=domain,
            started_at=started_at,
            ended_at=ended_at,
            insights_data=mock_insights_data,
        )

        import asyncio

        test_session.add(insight_record)
        asyncio.run(test_session.commit())

        response = test_client.get(
            f"/analytics/insights/{domain}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        assert len(data["insights"]) == 1
        assert data["insights"][0]["insightText"] == "Users are asking about authentication"
        assert data["insights"][0]["numberOfQueries"] == 15
        assert len(data["insights"][0]["examples"]) == 2

    def test_get_analytics_insights_no_insights(self, test_client: TestClient) -> None:
        """Test that the endpoint returns empty array when no insights exist"""
        domain = create_test_domain()

        response = test_client.get(
            f"/analytics/insights/{domain}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        assert data["insights"] == []

    def test_get_analytics_insights_most_recent(self, test_client: TestClient, test_session: Any) -> None:
        """Test that the endpoint returns only the most recent insights"""
        domain = create_test_domain()

        # Create two insight records - one older, one newer
        older_started = datetime.now() - timedelta(days=14)
        older_ended = datetime.now() - timedelta(days=7)
        older_insight_id = generate_insight_id(domain, older_started)
        older_insights_data = {
            "insights": [
                {
                    "insightText": "Old insight about API endpoints",
                    "numberOfQueries": 10,
                    "examples": [{"query": "How do I call endpoints?", "conversationId": "conv-old"}],
                }
            ]
        }

        newer_started = datetime.now() - timedelta(days=7)
        newer_ended = datetime.now()
        newer_insight_id = generate_insight_id(domain, newer_started)
        newer_insights_data = {
            "insights": [
                {
                    "insightText": "New insight about webhooks",
                    "numberOfQueries": 20,
                    "examples": [{"query": "How do webhooks work?", "conversationId": "conv-new"}],
                }
            ]
        }

        import asyncio

        older_record = InsightDb(
            insight_id=older_insight_id,
            domain=domain,
            started_at=older_started,
            ended_at=older_ended,
            insights_data=older_insights_data,
            created_at=datetime.now() - timedelta(days=3),
        )

        newer_record = InsightDb(
            insight_id=newer_insight_id,
            domain=domain,
            started_at=newer_started,
            ended_at=newer_ended,
            insights_data=newer_insights_data,
            created_at=datetime.now() - timedelta(days=1),
        )

        test_session.add(older_record)
        test_session.add(newer_record)
        asyncio.run(test_session.commit())

        response = test_client.get(
            f"/analytics/insights/{domain}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        assert len(data["insights"]) == 1
        # Should return the newer insight, not the older one
        assert data["insights"][0]["insightText"] == "New insight about webhooks"
        assert data["insights"][0]["numberOfQueries"] == 20
