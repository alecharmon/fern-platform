import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    String,
    Text,
)

from src.fai.db import Base
from src.fai.models.types.slack_integration_types import SlackIntegration


class SlackIntegrationDb(Base):
    __tablename__ = "slack_integrations"
    __table_args__ = {"extend_existing": True}

    integration_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    domain = Column(String, nullable=False, index=True)

    slack_team_id = Column(String, nullable=True, unique=True)
    slack_team_name = Column(String, nullable=True)
    slack_bot_token = Column(Text, nullable=True)
    slack_bot_user_id = Column(String, nullable=True)
    slack_app_id = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False)
    installed_at = Column(DateTime(timezone=True), nullable=True)

    settings = Column(JSON, nullable=True, default=dict)

    def to_api(self) -> SlackIntegration:
        return SlackIntegration(
            integration_id=self.integration_id,
            domain=self.domain,
            slack_team_id=self.slack_team_id,
            slack_team_name=self.slack_team_name,
            slack_bot_token=self.slack_bot_token,
            slack_bot_user_id=self.slack_bot_user_id,
            slack_app_id=self.slack_app_id,
            created_at=self.created_at,
            installed_at=self.installed_at,
            settings=self.settings,
        )
