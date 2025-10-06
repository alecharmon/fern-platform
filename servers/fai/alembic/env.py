import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection

from fai.db import (
    Base,
    engine,
)
from fai.models.db.code_db import CodeDb  # noqa: F401
from fai.models.db.discord_integration_db import DiscordIntegrationDb  # noqa: F401
from fai.models.db.discord_message_cache_db import DiscordMessageCacheDb  # noqa: F401
from fai.models.db.document_db import DocumentDb  # noqa: F401
from fai.models.db.feedback_db import FeedbackDb  # noqa: F401
from fai.models.db.guidance_db import GuidanceDb  # noqa: F401
from fai.models.db.insight_db import InsightDb  # noqa: F401
from fai.models.db.job_db import JobDb  # noqa: F401
from fai.models.db.query_db import QueryDb  # noqa: F401
from fai.models.db.settings_db import SettingsDb  # noqa: F401
from fai.models.db.slack_context_db import SlackContextDb  # noqa: F401
from fai.models.db.slack_integration_db import SlackIntegrationDb  # noqa: F401
from fai.models.db.slack_message_cache_db import SlackMessageCacheDb  # noqa: F401
from fai.models.db.slack_message_classification_db import SlackMessageClassificationDb  # noqa: F401

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
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async support."""
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
