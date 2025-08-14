from typing import List

from pydantic import BaseModel


class HistogramAnalyticsBarApi(BaseModel):
    label: str
    queryCount: int
    conversationCount: int


class HistogramAnalyticsApi(BaseModel):
    bars: List[HistogramAnalyticsBarApi]
