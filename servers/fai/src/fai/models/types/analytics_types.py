from pydantic import BaseModel


class HistogramAnalyticsBar(BaseModel):
    label: str
    queryCount: int
    conversationCount: int
    conversationsPositiveCount: int
    conversationsNegativeCount: int


class InsightExample(BaseModel):
    query: str
    conversationId: str


class Insight(BaseModel):
    insightText: str
    examples: list[str]


class InsightWithMetadata(BaseModel):
    insightText: str
    numberOfQueries: int
    examples: list[InsightExample]
