from typing import List
from typing import Optional

from pydantic import BaseModel


class TurbopufferRecord(BaseModel):
    id: str
    vector: list[float]
    chunk: str
    document: str
    title: str
    url: str
    version: Optional[str] = None
    keywords: Optional[List[str]] = None
    authed: Optional[bool] = None
