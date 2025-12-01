from sqlalchemy import (
    Column,
    DateTime,
    String,
    UniqueConstraint,
)

from fai.db import Base


class ScribeMessageCacheDb(Base):
    __tablename__ = "scribe_message_cache"
    __table_args__ = (
        UniqueConstraint("team_id", "message_ts", name="uq_scribe_message_cache_team_message"),
        {"extend_existing": True},
    )

    id = Column(String, primary_key=True)
    message_ts = Column(String, nullable=False, index=True)
    team_id = Column(String, nullable=False, index=True)
    processed_at = Column(DateTime(timezone=True), nullable=False)
