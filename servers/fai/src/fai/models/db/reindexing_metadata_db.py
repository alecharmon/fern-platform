from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
)

from fai.db import Base
from fai.models.db.utils.array_column import ArrayColumn


class ReindexingMetadataDb(Base):
    __tablename__ = "reindexing_metadata"
    __table_args__ = {"extend_existing": True}

    domain = Column(String, primary_key=True)
    status = Column(String, nullable=False)
    memory_mb = Column(Integer, nullable=False, default=0)
    retry_count = Column(Integer, nullable=False, default=0)
    task_arn = Column(String, nullable=True)
    sqs_message_id = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    num_inserted = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    task_arns = Column(ArrayColumn(String), nullable=True)
