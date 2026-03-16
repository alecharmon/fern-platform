import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
)

from fai.models.base import Base


class ScribeSessionDb(Base):
    __tablename__ = "scribe_sessions"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    integration_id = Column(String, ForeignKey("scribe_integrations.integration_id"), nullable=False, index=True)

    devin_session_id = Column(String, nullable=False, unique=True, index=True)
    devin_session_url = Column(Text, nullable=True)

    slack_thread_ts = Column(String, nullable=False, index=True)
    slack_channel = Column(String, nullable=False)

    status = Column(String, nullable=False)
    last_message_event_id = Column(String, nullable=True)

    pr_url = Column(String, nullable=True, index=True)
    pr_status = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
