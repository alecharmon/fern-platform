from datetime import datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    String,
)

from fai.models.api.analytics_api import GetInsightsResponse
from fai.models.base import Base


class InsightDb(Base):
    __tablename__ = "insights"
    __table_args__ = {"extend_existing": True}

    insight_id = Column(String, primary_key=True)
    domain = Column(String, nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ended_at = Column(DateTime(timezone=True), nullable=False)
    insights_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def to_api(self) -> GetInsightsResponse:
        return GetInsightsResponse(**self.insights_data)
