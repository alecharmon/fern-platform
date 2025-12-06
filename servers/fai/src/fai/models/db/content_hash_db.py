from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Index, String

from fai.models.base import Base


class ContentHashDb(Base):
    """
    Tracks content hashes for pages and endpoints to enable incremental reindexing.
    Avoids querying Turbopuffer (which has a 1200 record limit) by storing hashes in the database.
    """

    __tablename__ = "content_hashes"

    domain = Column(String, primary_key=True, nullable=False)
    parent_id = Column(String, primary_key=True, nullable=False, comment="FDR PageId or EndpointId")

    content_hash = Column(String, nullable=False, comment="SHA-256 hash of page markdown or endpoint document content")

    # Metadata
    indexed_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    __table_args__ = (
        Index("idx_content_hashes_domain", "domain"),
        Index("idx_content_hashes_domain_parent_id", "domain", "parent_id"),
    )
