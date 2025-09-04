from pydantic import (
    BaseModel,
    Field,
)

from src.fai.models.types.analytics_types import (
    HistogramAnalyticsBar,
    InsightWithMetadata,
)


class GetHistogramAnalyticsResponse(BaseModel):
    bars: list[HistogramAnalyticsBar] = Field(description="List of histogram analytics bars")


class GetInsightsResponse(BaseModel):
    insights: list[InsightWithMetadata] = Field(description="List of insights with query counts")
