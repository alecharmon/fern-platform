import asyncio
import logging
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

logger = logging.getLogger("alembic.env")

from fai.models.base import Base
from fai.models.db.code_db import CodeDb  # noqa: F401
from fai.models.db.conversation_report_db import ConversationReportDb  # noqa: F401
from fai.models.db.discord_integration_db import DiscordIntegrationDb  # noqa: F401
from fai.models.db.discord_message_cache_db import DiscordMessageCacheDb  # noqa: F401
from fai.models.db.document_db import DocumentDb  # noqa: F401
from fai.models.db.feedback_db import FeedbackDb  # noqa: F401
from fai.models.db.guidance_db import GuidanceDb  # noqa: F401
from fai.models.db.index_source_db import IndexSourceDb  # noqa: F401
from fai.models.db.insight_db import InsightDb  # noqa: F401
from fai.models.db.job_db import JobDb  # noqa: F401
from fai.models.db.query_db import QueryDb  # noqa: F401
from fai.models.db.reindexing_job_db import ReindexingJobDb  # noqa: F401
from fai.models.db.settings_db import SettingsDb  # noqa: F401
from fai.models.db.slack_context_db import SlackContextDb  # noqa: F401
from fai.models.db.slack_integration_db import SlackIntegrationDb  # noqa: F401
from fai.models.db.slack_message_cache_db import SlackMessageCacheDb  # noqa: F401
from fai.models.db.slack_message_classification_db import SlackMessageClassificationDb  # noqa: F401
from fai.models.db.website_db import WebsiteDb  # noqa: F401

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    connection.execute(text("ALTER TABLE IF EXISTS alembic_version ALTER COLUMN version_num TYPE varchar(128)"))
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def _ensure_asyncpg_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    if url.startswith("postgres+asyncpg://"):
        return "postgresql+asyncpg://" + url[len("postgres+asyncpg://") :]
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    return url


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async support."""
    url = os.environ.get("POSTGRES_MIGRATION_URL") or os.environ.get("POSTGRES_DATABASE_URL")
    if not url:
        raise RuntimeError("POSTGRES_MIGRATION_URL or POSTGRES_DATABASE_URL must be set")
    logger.info("Connecting to database for migrations...")
    connectable = create_async_engine(
        _ensure_asyncpg_url(url),
        poolclass=NullPool,
        connect_args={"statement_cache_size": 0},
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()
    logger.info("Migrations complete.")


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
