from datetime import (
    UTC,
    datetime,
)

from sqlalchemy import (
    Column,
    DateTime,
    String,
)

from fai.db import Base
from fai.models.types.editing_session_types import EditingSession


class EditingSessionDb(Base):
    """
    Database model for code editing sessions.

    Tracks multi-turn editing sessions where an AI agent makes changes
    to a repository and creates/updates PRs.
    """

    __tablename__ = "editing_sessions"
    __table_args__ = {"extend_existing": True}

    # Primary key - unique identifier for this editing session
    id = Column(String, primary_key=True)

    # Claude CLI session ID for conversation resumption
    session_id = Column(String, nullable=True)

    # Repository information
    repository = Column(String, nullable=False)
    base_branch = Column(String, nullable=False)
    working_branch = Column(String, nullable=False)

    # PR information
    pr_url = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    def to_api(self) -> EditingSession:
        """Convert database model to API model."""
        return EditingSession(
            id=self.id,
            session_id=self.session_id,
            repository=self.repository,
            base_branch=self.base_branch,
            working_branch=self.working_branch,
            pr_url=self.pr_url,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
