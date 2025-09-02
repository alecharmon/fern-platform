import time
from unittest.mock import patch

from fastapi.testclient import TestClient

from tests.factories import create_test_domain


class TestIndexReconstruct:
    def test_reconstruct_index_success(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        with patch("src.fai.routes.index.reconstruct_query_index_for_domain") as mock_reconstruct:
            mock_reconstruct.return_value = None

            response = test_client.post(f"/index/{domain}/reconstruct")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            mock_reconstruct.assert_called_once_with(domain)

    def test_reconstruct_index_failure(self, test_client: TestClient) -> None:
        domain = create_test_domain()

        with patch("src.fai.routes.index.reconstruct_query_index_for_domain") as mock_reconstruct:
            mock_reconstruct.side_effect = Exception("Reconstruction failed")

            response = test_client.post(f"/index/{domain}/reconstruct")

            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert data["detail"] == "Reconstruction failed"


class TestIndexSync:
    def test_sync_index_success(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = {"index_name": "test-index"}

        with patch("src.fai.routes.index.sync_index_to_target") as mock_sync, patch(
            "src.fai.routes.index.get_query_index_name"
        ) as mock_get_name:
            mock_sync.return_value = None
            mock_get_name.return_value = "query-index"

            response = test_client.post(f"/index/{domain}/sync", json=request_body)

            assert response.status_code == 200
            data = response.json()
            assert "job_id" in data
            job_id = data["job_id"]

            time.sleep(0.1)

            status_response = test_client.get(f"/jobs/{job_id}/status")
            assert status_response.status_code == 200
            status_data = status_response.json()
            assert status_data["job_id"] == job_id
            assert status_data["status"] == "completed"
            assert status_data["success"] is True

            mock_sync.assert_called_once_with(domain, "test-index", "query-index")

    def test_sync_index_failure(self, test_client: TestClient) -> None:
        domain = create_test_domain()
        request_body = {"index_name": "test-index"}

        with patch("src.fai.routes.index.sync_index_to_target") as mock_sync, patch(
            "src.fai.routes.index.get_query_index_name"
        ) as mock_get_name:
            mock_sync.side_effect = Exception("Sync failed")
            mock_get_name.return_value = "query-index"

            response = test_client.post(f"/index/{domain}/sync", json=request_body)

            assert response.status_code == 200
            data = response.json()
            assert "job_id" in data
            job_id = data["job_id"]

            time.sleep(0.1)

            status_response = test_client.get(f"/jobs/{job_id}/status")
            assert status_response.status_code == 200
            status_data = status_response.json()
            assert status_data["job_id"] == job_id
            assert status_data["status"] == "failed"
            assert status_data["success"] is False
            assert "Sync failed" in status_data["error"]


class TestJobStatus:
    def test_job_status_not_found(self, test_client: TestClient) -> None:
        fake_job_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.get(f"/jobs/{fake_job_id}/status")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Job not found"
