import requests


def test_health_check(fai_docker: None, docker_ip: str) -> None:
    """Test that the health check endpoint returns 200."""
    print("Running health check...")
    response = requests.get(f"http://{docker_ip}:8080/health", timeout=5)
    print(response.text)
    assert response.status_code == 200
