from typing import List
from typing import Optional

from pydantic import BaseModel


class TpufAttributesApi(BaseModel):
    chunk: str
    document: str
    title: str
    url: str
    version: Optional[str] = None
    keywords: Optional[List[str]] = None
    authed: Optional[bool] = None


class TpufRecordWithoutVectorApi(BaseModel):
    id: str
    attributes: TpufAttributesApi


class TpufRecordApi(TpufRecordWithoutVectorApi):
    vector: list[float]
