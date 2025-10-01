import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    String,
)

from fai.db import Base
from fai.models.types.discord_integration_types import DiscordIntegration


class DiscordIntegrationDb(Base):
    __tablename__ = "discord_integrations"
    __table_args__ = {"extend_existing": True}

    integration_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    domain = Column(String, nullable=False, index=True)

    discord_guild_id = Column(String, nullable=True, unique=True)
    discord_guild_name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False)
    installed_at = Column(DateTime(timezone=True), nullable=True)

    settings = Column(JSON, nullable=True, default=dict)

    def to_api(self) -> DiscordIntegration:
        return DiscordIntegration(
            integration_id=self.integration_id,
            domain=self.domain,
            discord_guild_id=self.discord_guild_id,
            discord_guild_name=self.discord_guild_name,
            created_at=self.created_at,
            installed_at=self.installed_at,
            settings=self.settings,
        )
