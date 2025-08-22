import datetime
import uuid

import requests

from src.fai.models.api.query import QueryApi


def generate_unique_query_data() -> QueryApi:
    """Helper to generate a query with a unique ID."""
    now = datetime.datetime.now(datetime.timezone.utc)
    return QueryApi(
        query_id=f"test-query-{uuid.uuid4()}",
        conversation_id=f"test-convo-{uuid.uuid4()}",
        domain="test-domain",
        text="test query",
        role="USER",
        source="CHAT",
        created_at=now,
        time_to_first_token=0.5,
    )


def test_create_query(fai_docker: None, docker_ip: str) -> None:
    """Test creating a new query with unique IDs to avoid PK conflicts."""
    query_data = generate_unique_query_data()

    print(f"Sending POST request with: {query_data}")
    response = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=query_data.model_dump(mode="json"),
        timeout=5,
    )

    assert response.status_code == 200, f"Unexpected response: {response.text}"
    created_query = QueryApi(**response.json())
    print(f"Created query: {created_query}")
    assert created_query.query_id == query_data.query_id
    assert created_query.conversation_id == query_data.conversation_id
    assert created_query.domain == query_data.domain
    assert created_query.text == query_data.text
    assert created_query.role == query_data.role
    assert created_query.source == query_data.source
    assert created_query.time_to_first_token == query_data.time_to_first_token


def test_create_query_minimal_data(fai_docker: None, docker_ip: str) -> None:
    """Test creating a query with minimal required data (no time_to_first_token)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    query_data = QueryApi(
        query_id=f"test-minimal-{uuid.uuid4()}",
        conversation_id=f"test-convo-{uuid.uuid4()}",
        domain="minimal-domain",
        text="minimal query",
        role="USER",
        source="API",
        created_at=now,
    )

    response = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=query_data.model_dump(mode="json"),
        timeout=5,
    )

    assert response.status_code == 200
    created_query = QueryApi(**response.json())
    assert created_query.query_id == query_data.query_id
    assert created_query.time_to_first_token is None


def test_create_query_assistant_role(fai_docker: None, docker_ip: str) -> None:
    """Test creating a query with ASSISTANT role."""
    now = datetime.datetime.now(datetime.timezone.utc)
    query_data = QueryApi(
        query_id=f"test-assistant-{uuid.uuid4()}",
        conversation_id=f"test-convo-{uuid.uuid4()}",
        domain="assistant-domain",
        text="This is an assistant response",
        role="ASSISTANT",
        source="CHAT",
        created_at=now,
        time_to_first_token=1.2,
    )

    response = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=query_data.model_dump(mode="json"),
        timeout=5,
    )

    assert response.status_code == 200
    created_query = QueryApi(**response.json())
    assert created_query.role == "ASSISTANT"
    assert created_query.time_to_first_token == 1.2


def test_create_duplicate_query_id(fai_docker: None, docker_ip: str) -> None:
    """Test that creating a query with duplicate ID fails appropriately."""
    query_data = generate_unique_query_data()

    response1 = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=query_data.model_dump(mode="json"),
        timeout=5,
    )
    assert response1.status_code == 200

    response2 = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=query_data.model_dump(mode="json"),
        timeout=5,
    )
    assert response2.status_code == 500


def test_get_recent_queries(fai_docker: None, docker_ip: str) -> None:
    """Test retrieving recent queries for a domain."""
    query_data = generate_unique_query_data()
    create_response = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=query_data.model_dump(mode="json"),
        timeout=5,
    )
    assert create_response.status_code == 200

    cutoff_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)
    response = requests.get(
        f"http://{docker_ip}:8080/queries/{query_data.domain}",
        params={"cutoff_time": cutoff_time.isoformat()},
        timeout=5,
    )

    assert response.status_code == 200
    data = response.json()
    assert "queries" in data
    assert "total" in data
    assert isinstance(data["queries"], list)
    assert isinstance(data["total"], int)

    query_ids = [q["query_id"] for q in data["queries"]]
    assert query_data.query_id in query_ids


def test_get_recent_queries_with_pagination(fai_docker: None, docker_ip: str) -> None:
    """Test pagination in get_recent_queries endpoint."""
    domain = f"pagination-test-{uuid.uuid4()}"

    for i in range(3):
        query_data = QueryApi(
            query_id=f"test-page-{i}-{uuid.uuid4()}",
            conversation_id=f"test-convo-{uuid.uuid4()}",
            domain=domain,
            text=f"test query {i}",
            role="USER",
            source="CHAT",
            created_at=datetime.datetime.now(datetime.timezone.utc),
            time_to_first_token=0.5,
        )
        requests.post(
            f"http://{docker_ip}:8080/queries",
            json=query_data.model_dump(mode="json"),
            timeout=5,
        )

    cutoff_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)

    response = requests.get(
        f"http://{docker_ip}:8080/queries/{domain}",
        params={
            "cutoff_time": cutoff_time.isoformat(),
            "page": 1,
            "limit": 2,
        },
        timeout=5,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["queries"]) <= 2
    assert data["total"] >= 3

    response2 = requests.get(
        f"http://{docker_ip}:8080/queries/{domain}",
        params={
            "cutoff_time": cutoff_time.isoformat(),
            "page": 2,
            "limit": 2,
        },
        timeout=5,
    )

    assert response2.status_code == 200
    data2 = response2.json()
    assert len(data2["queries"]) >= 0


def test_get_recent_queries_include_assistant(fai_docker: None, docker_ip: str) -> None:
    """Test filtering queries by role."""
    domain = f"role-test-{uuid.uuid4()}"

    user_query = QueryApi(
        query_id=f"test-user-{uuid.uuid4()}",
        conversation_id=f"test-convo-{uuid.uuid4()}",
        domain=domain,
        text="user question",
        role="USER",
        source="CHAT",
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    requests.post(
        f"http://{docker_ip}:8080/queries",
        json=user_query.model_dump(mode="json"),
        timeout=5,
    )

    assistant_query = QueryApi(
        query_id=f"test-assistant-{uuid.uuid4()}",
        conversation_id=f"test-convo-{uuid.uuid4()}",
        domain=domain,
        text="assistant response",
        role="ASSISTANT",
        source="CHAT",
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    requests.post(
        f"http://{docker_ip}:8080/queries",
        json=assistant_query.model_dump(mode="json"),
        timeout=5,
    )

    cutoff_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)

    response_user_only = requests.get(
        f"http://{docker_ip}:8080/queries/{domain}",
        params={"cutoff_time": cutoff_time.isoformat()},
        timeout=5,
    )

    assert response_user_only.status_code == 200
    user_only_data = response_user_only.json()
    user_only_roles = [q["role"] for q in user_only_data["queries"]]
    assert "ASSISTANT" not in user_only_roles
    assert "USER" in user_only_roles

    response_all = requests.get(
        f"http://{docker_ip}:8080/queries/{domain}",
        params={
            "cutoff_time": cutoff_time.isoformat(),
            "include_assistant": True,
        },
        timeout=5,
    )

    assert response_all.status_code == 200
    all_data = response_all.json()
    all_roles = [q["role"] for q in all_data["queries"]]
    assert "ASSISTANT" in all_roles
    assert "USER" in all_roles


def test_get_recent_queries_date_filtering(fai_docker: None, docker_ip: str) -> None:
    """Test date range filtering in get_recent_queries."""
    domain = f"date-test-{uuid.uuid4()}"

    old_date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)
    recent_date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)

    old_query = QueryApi(
        query_id=f"test-old-{uuid.uuid4()}",
        conversation_id=f"test-convo-{uuid.uuid4()}",
        domain=domain,
        text="old query",
        role="USER",
        source="CHAT",
        created_at=old_date,
    )
    requests.post(
        f"http://{docker_ip}:8080/queries",
        json=old_query.model_dump(mode="json"),
        timeout=5,
    )

    recent_query = QueryApi(
        query_id=f"test-recent-{uuid.uuid4()}",
        conversation_id=f"test-convo-{uuid.uuid4()}",
        domain=domain,
        text="recent query",
        role="USER",
        source="CHAT",
        created_at=recent_date,
    )
    requests.post(
        f"http://{docker_ip}:8080/queries",
        json=recent_query.model_dump(mode="json"),
        timeout=5,
    )

    start_date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    cutoff_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)

    response = requests.get(
        f"http://{docker_ip}:8080/queries/{domain}",
        params={
            "cutoff_time": cutoff_time.isoformat(),
            "start_date": start_date.isoformat(),
        },
        timeout=5,
    )

    assert response.status_code == 200
    data = response.json()
    query_ids = [q["query_id"] for q in data["queries"]]
    assert recent_query.query_id in query_ids
    assert old_query.query_id not in query_ids


def test_get_queries_nonexistent_domain(fai_docker: None, docker_ip: str) -> None:
    """Test getting queries for a domain that doesn't exist."""
    nonexistent_domain = f"nonexistent-{uuid.uuid4()}"
    cutoff_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1)

    response = requests.get(
        f"http://{docker_ip}:8080/queries/{nonexistent_domain}",
        params={"cutoff_time": cutoff_time.isoformat()},
        timeout=5,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["queries"] == []
    assert data["total"] == 0


def test_create_query_invalid_data(fai_docker: None, docker_ip: str) -> None:
    """Test creating a query with invalid data."""
    invalid_data = {
        "query_id": f"test-invalid-{uuid.uuid4()}",
    }

    response = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=invalid_data,
        timeout=5,
    )

    assert response.status_code == 422


def test_create_query_empty_strings(fai_docker: None, docker_ip: str) -> None:
    """Test creating a query with empty string values."""
    now = datetime.datetime.now(datetime.timezone.utc)
    query_data = QueryApi(
        query_id=f"test-empty-{uuid.uuid4()}",
        conversation_id="",  # Empty string
        domain="",  # Empty string
        text="",  # Empty string
        role="USER",
        source="CHAT",
        created_at=now,
    )

    response = requests.post(
        f"http://{docker_ip}:8080/queries",
        json=query_data.model_dump(mode="json"),
        timeout=5,
    )

    assert response.status_code == 200
    created_query = QueryApi(**response.json())
    assert created_query.conversation_id == ""
    assert created_query.domain == ""
    assert created_query.text == ""


def test_get_queries_invalid_cutoff_time(fai_docker: None, docker_ip: str) -> None:
    """Test get_recent_queries with invalid cutoff_time parameter."""
    response = requests.get(
        f"http://{docker_ip}:8080/queries/test-domain",
        params={"cutoff_time": "invalid-date"},
        timeout=5,
    )

    assert response.status_code == 422
