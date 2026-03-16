from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    String,
)

from fai.models.base import Base


class ConversationReportDb(Base):
    __tablename__ = "conversation_reports"
    __table_args__ = {"extend_existing": True}

    conversation_id = Column(String, primary_key=True)
    domain = Column(String, nullable=False, index=True)
    resolved = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
