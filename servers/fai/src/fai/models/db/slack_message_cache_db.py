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

from fai.models.base import Base


class SlackMessageCacheDb(Base):
    __tablename__ = "slack_message_cache"

    id = Column(String, primary_key=True, nullable=False, default=lambda: str(uuid4()))

    message_ts = Column(String, nullable=False)

    team_id = Column(String, nullable=False)

    processed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    __table_args__ = (
        Index("idx_slack_message_cache_processed_at", "processed_at"),
        Index("idx_slack_message_cache_team_ts", "team_id", "message_ts"),
        UniqueConstraint("team_id", "message_ts", name="uq_slack_message_cache_team_message"),
    )
