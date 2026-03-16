from datetime import (
    UTC,
    datetime,
)

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
)

from fai.models.base import Base
from fai.models.db.utils.array_column import ArrayColumn


class ReindexingJobDb(Base):
    __tablename__ = "reindexing_jobs"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    sqs_message_id = Column(String, nullable=True, unique=True)
    domain = Column(String, nullable=False, index=True)
    basepath = Column(String, nullable=True)
    force_full_reindex = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="queued")
    memory_mb = Column(Integer, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    task_arns = Column(ArrayColumn(String), nullable=True)
    error = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    num_inserted = Column(Integer, nullable=True)
    num_deleted = Column(Integer, nullable=True)
    job_total_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    started_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    completed_at = Column(DateTime(timezone=True), nullable=True)
