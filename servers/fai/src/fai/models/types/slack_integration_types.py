from datetime import datetime

from pydantic import BaseModel

from fai.models.api.update_channel_settings import ChannelSettings


class SlackIntegration(BaseModel):
    integration_id: str
    domain: str
    slack_team_id: str | None = None
    slack_team_name: str | None = None
    slack_bot_token: str | None = None
    slack_bot_user_id: str | None = None
    slack_app_id: str | None = None
    created_at: datetime
    installed_at: datetime | None = None
    settings: dict[str, ChannelSettings] | None = None


class CreateSlackIntegration(BaseModel):
    domain: str


class SlackIntegrationResponse(BaseModel):
    integration_id: str
    domain: str
    slack_team_id: str | None = None
    slack_team_name: str | None = None
    created_at: datetime
    installed_at: datetime | None = None
