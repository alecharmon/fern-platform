from enum import Enum

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    String,
)
from sqlalchemy import Enum as SQLEnum

from fai.db import Base


class SourceType(str, Enum):
    WEBSITE = "website"
    GITHUB = "github"


class IndexSourceStatus(str, Enum):
    ACTIVE = "active"
    INDEXING = "indexing"
    FAILED = "failed"
    PAUSED = "paused"


class IndexSourceDb(Base):
    __tablename__ = "index_sources"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    domain = Column(String, nullable=False, index=True)
    source_type = Column(SQLEnum(SourceType), nullable=False, index=True)

    # Source identifier (base_url for websites, repo_url for github)
    source_identifier = Column(String, nullable=False)

    # Configuration used for indexing (stored as JSON)
    config = Column(JSON, nullable=False)

    # Status tracking
    last_indexed_at = Column(DateTime(timezone=True), nullable=True)
    job_id = Column(String, nullable=True)
    status = Column(SQLEnum(IndexSourceStatus), nullable=False)

    # Source-specific metrics (stored as JSON for flexibility)
    metrics = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
