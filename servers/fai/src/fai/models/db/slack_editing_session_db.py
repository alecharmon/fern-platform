from datetime import (
    UTC,
    datetime,
)
from uuid import uuid4

from sqlalchemy import (
    Column,
    DateTime,
    Index,
    String,
    UniqueConstraint,
)

from fai.db import Base


class SlackEditingSessionDb(Base):
    __tablename__ = "slack_editing_sessions"

    id = Column(String, primary_key=True, nullable=False, default=lambda: str(uuid4()))

    team_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=False)
    thread_ts = Column(String, nullable=False)

    editing_id = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    __table_args__ = (
        Index("idx_slack_editing_session_team", "team_id"),
        Index("idx_slack_editing_session_editing_id", "editing_id"),
        UniqueConstraint("team_id", "channel_id", "thread_ts", name="uq_slack_editing_session_thread"),
    )
