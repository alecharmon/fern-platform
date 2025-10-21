from pydantic import (
    BaseModel,
    Field,
)

from fai.models.types.analytics_types import (
    HistogramAnalyticsBar,
    InsightWithMetadata,
)


class GetHistogramAnalyticsResponse(BaseModel):
    bars: list[HistogramAnalyticsBar] = Field(description="List of histogram analytics bars")


class GetInsightsResponse(BaseModel):
    insights: list[InsightWithMetadata] = Field(description="List of insights with query counts")


class GetConversationResolutionResponse(BaseModel):
    total_conversations: int = Field(description="Total number of conversations in the period")
    resolved_conversations: int = Field(description="Number of resolved conversations")
    unresolved_conversations: int = Field(description="Number of unresolved conversations")
    resolution_rate: float = Field(description="Percentage of conversations resolved (0-100)")
