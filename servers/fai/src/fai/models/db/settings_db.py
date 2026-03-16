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
from sqlalchemy.orm import validates

from fai.models.base import Base
from fai.models.types.settings_types import Settings


class SettingsDb(Base):
    __tablename__ = "settings"
    __table_args__ = {"extend_existing": True}

    domain = Column(String, primary_key=True)
    basepath = Column(String, nullable=False, default="", primary_key=True)
    org_name = Column(String, primary_key=False)
    created_time = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    last_reindex_time = Column(DateTime, nullable=True)

    docs_enabled = Column(Boolean, nullable=False, default=True)
    slack_enabled = Column(Boolean, nullable=False, default=True)
    discord_enabled = Column(Boolean, nullable=False, default=True)
    is_preview = Column(Boolean, nullable=False, default=False)
    decompose_queries = Column(Boolean, nullable=False, default=False)

    @validates("basepath")
    def _coerce_basepath(self, _key: str, value: str | None) -> str:
        return value if value is not None else ""

    def to_api(self) -> Settings:
        return Settings(
            domain=self.domain,
            org_name=self.org_name,
            created_time=self.created_time,
            last_reindex_time=self.last_reindex_time,
            docs_enabled=self.docs_enabled,
            slack_enabled=self.slack_enabled,
            discord_enabled=self.discord_enabled,
            is_preview=self.is_preview,
            decompose_queries=self.decompose_queries,
        )
