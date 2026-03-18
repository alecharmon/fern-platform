import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    String,
    Text,
)

from fai.models.base import Base


class ScribeIntegrationDb(Base):
    __tablename__ = "scribe_integrations"
    __table_args__ = {"extend_existing": True}

    integration_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    github_repo = Column(String, nullable=False, index=True)
    org_id = Column(String, nullable=True, index=True)

    slack_team_id = Column(String, nullable=True, unique=True)
    slack_team_name = Column(String, nullable=True)
    slack_bot_token = Column(Text, nullable=True)
    slack_bot_user_id = Column(String, nullable=True)
    slack_app_id = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False)
    installed_at = Column(DateTime(timezone=True), nullable=True)

    settings = Column(JSON, nullable=True, default=dict)
