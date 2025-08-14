from typing import List

from pydantic import BaseModel


class InsightResponse(BaseModel):
    insightText: str
    examples: List[str]


class InsightApi(InsightResponse):
    numberOfQueries: int


class InsightsApi(BaseModel):
    insights: List[InsightApi]
