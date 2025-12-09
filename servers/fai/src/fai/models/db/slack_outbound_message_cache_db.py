from sqlalchemy import Column, DateTime, String

from fai.db import Base


class SlackOutboundMessageCacheDb(Base):
    __tablename__ = "slack_outbound_message_cache"
    __table_args__ = {"extend_existing": True}

    message_key = Column(String, primary_key=True)
    sent_at = Column(DateTime(timezone=True), nullable=False)
