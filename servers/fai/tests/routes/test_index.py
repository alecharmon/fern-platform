from datetime import UTC
from unittest.mock import (
    AsyncMock,
    patch,
)

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
        ) as mock_get_name, patch(
            "src.fai.routes.index.job_manager.create_job", new_callable=AsyncMock
        ) as mock_create_job, patch(
            "src.fai.routes.index.job_manager.get_job_status", new_callable=AsyncMock
        ) as mock_get_job_status:
            mock_sync.return_value = None
            mock_get_name.return_value = "query-index"
            mock_create_job.return_value = "test-job-id-123"

            from datetime import datetime

            from src.fai.models.db.job_db import JobDb

            mock_job = JobDb(id="test-job-id-123", status="pending", created_at=datetime.now(UTC))
            mock_get_job_status.return_value = mock_job

            response = test_client.post(f"/index/{domain}/sync", json=request_body)

            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == "test-job-id-123"

            # Check job status
            status_response = test_client.get("/jobs/test-job-id-123/status")
            assert status_response.status_code == 200
            status_data = status_response.json()
            assert status_data["job_id"] == "test-job-id-123"
            assert status_data["status"] == "pending"
            assert status_data["created_at"] is not None


class TestJobStatus:
    def test_job_status_not_found(self, test_client: TestClient) -> None:
        fake_job_id = "00000000-0000-0000-0000-000000000000"

        with patch("src.fai.routes.index.job_manager.get_job_status", new_callable=AsyncMock) as mock_get_job_status:
            mock_get_job_status.return_value = None

            response = test_client.get(f"/jobs/{fake_job_id}/status")

            assert response.status_code == 404
            data = response.json()
            assert "detail" in data
            assert data["detail"] == "Job not found"
