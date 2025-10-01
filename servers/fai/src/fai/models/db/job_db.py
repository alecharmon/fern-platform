from sqlalchemy import (
    Column,
    DateTime,
    String,
    Text,
)

from fai.db import Base


class JobDb(Base):
    __tablename__ = "jobs"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    status = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
