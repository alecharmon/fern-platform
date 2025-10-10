from datetime import (
    UTC,
    datetime,
)

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    String,
)

from fai.db import Base
from fai.models.types.settings_types import Settings


class SettingsDb(Base):
    __tablename__ = "settings"
    __table_args__ = {"extend_existing": True}

    domain = Column(String, primary_key=True)
    org_name = Column(String, primary_key=False)
    created_time = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    last_reindex_time = Column(DateTime, nullable=True)
    job_id = Column(String, nullable=True)

    docs_enabled = Column(Boolean, nullable=False, default=True)
    slack_enabled = Column(Boolean, nullable=False, default=True)
    discord_enabled = Column(Boolean, nullable=False, default=True)
    is_preview = Column(Boolean, nullable=False, default=False)

    def to_api(self) -> Settings:
        return Settings(
            domain=self.domain,
            org_name=self.org_name,
            created_time=self.created_time,
            last_reindex_time=self.last_reindex_time,
            job_id=self.job_id,
            docs_enabled=self.docs_enabled,
            slack_enabled=self.slack_enabled,
            discord_enabled=self.discord_enabled,
            is_preview=self.is_preview,
        )
