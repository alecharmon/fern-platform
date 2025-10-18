from datetime import datetime

from pydantic import BaseModel

from fai.models.types.channel_settings_type import DiscordChannelSettings


class DiscordIntegration(BaseModel):
    integration_id: str
    domain: str
    discord_guild_id: str | None = None
    discord_guild_name: str | None = None
    created_at: datetime
    installed_at: datetime | None = None
    settings: dict[str, DiscordChannelSettings] | None = None


class CreateDiscordIntegration(BaseModel):
    domain: str


class DiscordIntegrationResponse(BaseModel):
    integration_url: str
