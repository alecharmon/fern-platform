from datetime import (
    datetime,
    timedelta,
)
from unittest.mock import patch

from fastapi.testclient import TestClient

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

        with patch("src.fai.routes.analytics.fetch_grouped_data") as mock_fetch, patch(
            "src.fai.routes.analytics.fill_date_gaps"
        ) as mock_fill:
            mock_fetch.return_value = []
            mock_fill.return_value = mock_histogram_data

            response = test_client.get(f"/analytics/histogram/{domain}")

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

        with patch("src.fai.routes.analytics.fetch_grouped_data") as mock_fetch, patch(
            "src.fai.routes.analytics.fill_date_gaps"
        ) as mock_fill:
            mock_fetch.return_value = []
            mock_fill.return_value = mock_histogram_data

            response = test_client.get(
                f"/analytics/histogram/{domain}",
                params={"start_date": start_date.isoformat(), "end_date": end_date.isoformat(), "group_by": "WEEK"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "bars" in data

    def test_get_analytics_histogram_invalid_group_by(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        response = test_client.get(f"/analytics/histogram/{domain}", params={"group_by": "INVALID"})

        assert response.status_code == 422  # Pydantic validation error
        data = response.json()
        assert "detail" in data

    def test_get_analytics_histogram_failure(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        with patch("src.fai.routes.analytics.fetch_grouped_data") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            response = test_client.get(f"/analytics/histogram/{domain}")

            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert data["detail"] == "Database error"


class TestAnalyticsInsights:
    def test_get_analytics_insights_success(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        mock_insights = {"total_queries": 100, "top_queries": ["query1", "query2"], "avg_response_time": 1.5}

        with patch("src.fai.routes.analytics.get_insights_from_queries") as mock_insights_fn:
            mock_insights_fn.return_value = mock_insights

            response = test_client.get(f"/analytics/insights/{domain}")

            assert response.status_code == 200
            data = response.json()
            assert data == mock_insights

    def test_get_analytics_insights_with_date_range(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        start_date = datetime.now() - timedelta(days=30)
        end_date = datetime.now()

        mock_insights = {"total_queries": 50}

        with patch("src.fai.routes.analytics.get_insights_from_queries") as mock_insights_fn:
            mock_insights_fn.return_value = mock_insights

            response = test_client.get(
                f"/analytics/insights/{domain}",
                params={"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
            )

            assert response.status_code == 200
            data = response.json()
            assert data == mock_insights

    def test_get_analytics_insights_failure(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        with patch("src.fai.routes.analytics.get_insights_from_queries") as mock_insights_fn:
            mock_insights_fn.side_effect = Exception("Insights error")

            response = test_client.get(f"/analytics/insights/{domain}")

            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert data["detail"] == "Insights error"
