from sqlalchemy import select

from src.fai.db import async_session_maker
from src.fai.models.db.discord_integration_db import DiscordIntegrationDb


async def get_discord_integration(guild_id: str) -> DiscordIntegrationDb | None:
    async with async_session_maker() as session:
        result = await session.execute(
            select(DiscordIntegrationDb).where(DiscordIntegrationDb.discord_guild_id == guild_id).limit(1)
        )
        integration = result.scalar_one_or_none()
        return integration
