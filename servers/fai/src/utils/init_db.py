import asyncio

from src.fai.db import (
    Base,
    engine,
)
from src.fai.models.db.code_db import CodeDb  # noqa: F401
from src.fai.models.db.discord_integration_db import DiscordIntegrationDb  # noqa: F401
from src.fai.models.db.discord_message_cache_db import DiscordMessageCacheDb  # noqa: F401
from src.fai.models.db.document_db import DocumentDb  # noqa: F401
from src.fai.models.db.feedback_db import FeedbackDb  # noqa: F401
from src.fai.models.db.guidance_db import GuidanceDb  # noqa: F401
from src.fai.models.db.insight_db import InsightDb  # noqa: F401
from src.fai.models.db.job_db import JobDb  # noqa: F401
from src.fai.models.db.query_db import QueryDb  # noqa: F401
from src.fai.models.db.settings_db import SettingsDb  # noqa: F401
from src.fai.models.db.slack_integration_db import SlackIntegrationDb  # noqa: F401
from src.fai.models.db.slack_message_cache_db import SlackMessageCacheDb  # noqa: F401


async def init() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(init())
