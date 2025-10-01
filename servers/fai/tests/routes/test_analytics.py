from datetime import (
    datetime,
    timedelta,
)
from unittest.mock import patch

from fastapi.testclient import TestClient

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
    def test_get_analytics_insights_insufficient_queries(self, test_client: TestClient) -> None:
        """Test that the endpoint returns 400 when there are insufficient queries"""
        domain = create_test_domain()

        response = test_client.get(
            f"/analytics/insights/{domain}", headers={"Authorization": f"Bearer {TEST_FERN_TOKEN}"}
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Not enough queries to generate insights"
