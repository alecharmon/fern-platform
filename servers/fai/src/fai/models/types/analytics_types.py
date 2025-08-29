from pydantic import BaseModel


class HistogramAnalyticsBar(BaseModel):
    label: str
    queryCount: int
    conversationCount: int


class Insight(BaseModel):
    insightText: str
    examples: list[str]


class InsightWithCount(Insight):
    numberOfQueries: int
