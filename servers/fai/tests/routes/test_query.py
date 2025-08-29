from datetime import (
    UTC,
    datetime,
)

from fastapi.testclient import TestClient
from tests.factories import (
    QueryFactory,
    create_test_domain,
)


class TestCreateQuery:
    def test_create_query_success(self, test_client: TestClient) -> None:
        query = QueryFactory.build()

        # Convert datetime to string for JSON serialization
        query_data = query.model_dump()
        query_data["created_at"] = query.created_at.isoformat()

        response = test_client.post("/queries", json=query_data)

        assert response.status_code == 200
        data = response.json()
        assert data["query_id"] == query.query_id

    def test_create_query_database_error(self, test_client: TestClient) -> None:
        # Create a query with invalid data to trigger error handling
        invalid_query_data = {
            "query_id": "test-query-id",
            "conversation_id": "test-conversation",
            "domain": "test-domain",
            "text": "test text",
            "role": "USER",
            "source": "test",
            "created_at": "invalid-date-format",  # Invalid datetime format
        }

        response = test_client.post("/queries", json=invalid_query_data)

        # Expect validation error or server error depending on where it fails
        assert response.status_code in [422, 500]
        data = response.json()
        assert "detail" in data


class TestGetQueries:
    def test_get_queries_success(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        response = test_client.get(f"/queries/{domain}")

        assert response.status_code == 200
        data = response.json()
        assert "queries" in data
        assert "pagination" in data
        assert isinstance(data["queries"], list)
        assert "total" in data["pagination"]
        assert "page" in data["pagination"]
        assert "limit" in data["pagination"]

    def test_get_queries_with_pagination(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        response = test_client.get(f"/queries/{domain}", params={"page": 2, "limit": 10})

        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["page"] == 2
        assert data["pagination"]["limit"] == 10

    def test_get_queries_with_date_filters(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        now = datetime.now(UTC)
        start_date = now.replace(day=1).isoformat()
        end_date = now.isoformat()

        response = test_client.get(
            f"/queries/{domain}", params={"start_date": start_date, "end_date": end_date, "include_assistant": True}
        )

        assert response.status_code == 200
        data = response.json()
        assert "queries" in data
        assert "pagination" in data

    def test_get_queries_user_only(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        response = test_client.get(f"/queries/{domain}", params={"include_assistant": False})

        assert response.status_code == 200
        data = response.json()
        assert "queries" in data

    def test_get_queries_with_cutoff_time(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        cutoff_time = datetime.now(UTC).isoformat()

        response = test_client.get(f"/queries/{domain}", params={"cutoff_time": cutoff_time})

        assert response.status_code == 200
        data = response.json()
        assert "queries" in data
        assert "pagination" in data
