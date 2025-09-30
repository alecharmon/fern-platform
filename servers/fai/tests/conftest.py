import importlib
import os
import pkgutil
from collections.abc import (
    AsyncGenerator,
    Generator,
)
from typing import Any

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import (
    ASGITransport,
    AsyncClient,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.fai.db import Base

TEST_FERN_TOKEN = os.environ.get("FERN_TOKEN") or "test-fern-token"
TEST_ANTHROPIC_API_KEY = "test-anthropic-api-key"
TEST_COHERE_API_KEY = "test-cohere-api-key"
TEST_OPENAI_API_KEY = "test-openai-api-key"
TEST_TURBOPUFFER_API_KEY = "test-turbopuffer-api-key"
TEST_SLACK_CLIENT_ID = "test-slack-client-id"
TEST_SLACK_CLIENT_SECRET = "test-slack-client-secret"
TEST_SLACK_SIGNING_SECRET = "test-slack-signing-secret"
TEST_DISCORD_BOT_TOKEN = "test-discord-bot-token"
TEST_DISCORD_OAUTH_URL = "test-discord-oauth-url"
ROUTES_PACKAGE_NAME = "src.fai.routes"


def _load_routes() -> None:
    for _, module_name, is_pkg in pkgutil.iter_modules([ROUTES_PACKAGE_NAME.replace(".", "/")]):
        full_module_name = f"{ROUTES_PACKAGE_NAME}.{module_name}"
        importlib.import_module(full_module_name)


@pytest.fixture(scope="session")
def test_database_url() -> str:
    return "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def test_engine(test_database_url: str) -> AsyncEngine:
    engine = create_async_engine(test_database_url, echo=False)
    return engine


@pytest_asyncio.fixture
async def test_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    from src.fai.models.db.code_db import CodeDb  # noqa: F401
    from src.fai.models.db.document_db import DocumentDb  # noqa: F401
    from src.fai.models.db.feedback_db import FeedbackDb  # noqa: F401
    from src.fai.models.db.guidance_db import GuidanceDb  # noqa: F401
    from src.fai.models.db.insight_db import InsightDb  # noqa: F401
    from src.fai.models.db.job_db import JobDb  # noqa: F401
    from src.fai.models.db.query_db import QueryDb  # noqa: F401

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session_maker = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_maker() as session:
        yield session


@pytest.fixture(autouse=True)
def setup_test_env(test_database_url: str) -> Any:
    original_url = os.environ.get("POSTGRES_DATABASE_URL")
    os.environ["IS_LOCAL"] = "true"
    os.environ["FERN_TOKEN"] = TEST_FERN_TOKEN
    os.environ["POSTGRES_DATABASE_URL"] = test_database_url
    os.environ["COHERE_API_KEY"] = TEST_COHERE_API_KEY
    os.environ["ANTHROPIC_API_KEY"] = TEST_ANTHROPIC_API_KEY
    os.environ["TURBOPUFFER_API_KEY"] = TEST_TURBOPUFFER_API_KEY
    os.environ["OPENAI_API_KEY"] = TEST_OPENAI_API_KEY
    os.environ["FERN_API_KEY"] = TEST_FERN_TOKEN
    os.environ["DISCORD_BOT_TOKEN"] = TEST_DISCORD_BOT_TOKEN
    os.environ["DISCORD_OAUTH_URL"] = TEST_DISCORD_OAUTH_URL
    os.environ["SLACK_CLIENT_ID"] = TEST_SLACK_CLIENT_ID
    os.environ["SLACK_CLIENT_SECRET"] = TEST_SLACK_CLIENT_SECRET
    os.environ["SLACK_SIGNING_SECRET"] = TEST_SLACK_SIGNING_SECRET

    yield

    if original_url:
        os.environ["POSTGRES_DATABASE_URL"] = original_url
    else:
        os.environ.pop("POSTGRES_DATABASE_URL", None)


@pytest.fixture
def test_client(setup_test_env: Any, test_session: AsyncSession) -> Generator[TestClient, None, None]:
    from src.fai.app import fai_app
    from src.fai.dependencies import get_db

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_session

    fai_app.dependency_overrides[get_db] = override_get_db
    _load_routes()

    client = TestClient(fai_app)
    yield client

    fai_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_test_client(setup_test_env: Any) -> AsyncGenerator[AsyncClient, None]:
    from src.fai.app import fai_app

    _load_routes()
    async with AsyncClient(transport=ASGITransport(app=fai_app), base_url="http://test") as client:
        yield client
