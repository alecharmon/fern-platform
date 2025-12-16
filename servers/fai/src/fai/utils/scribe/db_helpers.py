from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fai.db import async_session_maker
from fai.models.db.scribe_integration_db import ScribeIntegrationDb
from fai.models.db.scribe_session_db import ScribeSessionDb


async def get_scribe_integration_by_team_id(team_id: str) -> ScribeIntegrationDb | None:
    async with async_session_maker() as session:
        result = await session.execute(select(ScribeIntegrationDb).where(ScribeIntegrationDb.slack_team_id == team_id))
        return result.scalar_one_or_none()


async def get_scribe_integration_by_id(integration_id: str) -> ScribeIntegrationDb | None:
    async with async_session_maker() as session:
        result = await session.execute(
            select(ScribeIntegrationDb).where(ScribeIntegrationDb.integration_id == integration_id)
        )
        return result.scalar_one_or_none()


async def get_scribe_session_by_id(session_id: str, db: AsyncSession | None = None) -> ScribeSessionDb | None:
    if db:
        result = await db.execute(select(ScribeSessionDb).where(ScribeSessionDb.id == session_id))
        return result.scalar_one_or_none()

    async with async_session_maker() as session:
        result = await session.execute(select(ScribeSessionDb).where(ScribeSessionDb.id == session_id))
        return result.scalar_one_or_none()
