import uuid
from datetime import (
    UTC,
    datetime,
)
from enum import Enum
from typing import Any

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    String,
)
from sqlalchemy import Enum as SQLEnum

from fai.models.base import Base


class SourceType(str, Enum):
    WEBSITE = "WEBSITE"
    GITHUB = "GITHUB"
    GITHUB_DOMAIN_ROOT = "GITHUB_DOMAIN_ROOT"


class IndexSourceStatus(str, Enum):
    ACTIVE = "active"
    INDEXING = "indexing"
    FAILED = "failed"
    PAUSED = "paused"


class IndexSourceDb(Base):
    __tablename__ = "index_sources"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    domain = Column(String, nullable=False, index=True)
    source_type = Column(SQLEnum(SourceType), nullable=False, index=True)

    # Source identifier (base_url for websites, repo_url for github)
    source_identifier = Column(String, nullable=False)

    # Configuration used for indexing (stored as JSON)
    config = Column[Any](JSON, nullable=False)

    # Status tracking
    last_indexed_at = Column(DateTime(timezone=True), nullable=True)
    job_id = Column(String, nullable=True)
    status = Column(SQLEnum(IndexSourceStatus), nullable=False)

    # Source-specific metrics (stored as JSON for flexibility)
    metrics = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
