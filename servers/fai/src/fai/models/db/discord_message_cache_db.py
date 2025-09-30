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

from src.fai.db import Base


class DiscordMessageCacheDb(Base):
    __tablename__ = "discord_message_cache"

    id = Column(String, primary_key=True, nullable=False, default=lambda: str(uuid4()))

    message_id = Column(String, nullable=False)

    discord_guild_id = Column(String, nullable=False)

    processed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    __table_args__ = (
        Index("idx_discord_message_cache_processed_at", "processed_at"),
        Index("idx_discord_message_cache_team_ts", "discord_guild_id", "message_id"),
        UniqueConstraint("discord_guild_id", "message_id", name="uq_discord_message_cache_guild_message"),
    )
