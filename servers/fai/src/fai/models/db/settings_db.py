from sqlalchemy import (
    Column,
    DateTime,
    String,
)

from src.fai.db import Base
from src.fai.models.types.settings_types import Settings


class SettingsDb(Base):
    __tablename__ = "settings"
    __table_args__ = {"extend_existing": True}

    domain = Column(String, primary_key=True)
    org_name = Column(String, primary_key=False)
    last_reindex_time = Column(DateTime, nullable=True)
    job_id = Column(String, nullable=True)

    def to_api(self) -> Settings:
        return Settings(
            domain=self.domain,
            org_name=self.org_name,
            last_reindex_time=self.last_reindex_time,
            job_id=self.job_id,
        )
