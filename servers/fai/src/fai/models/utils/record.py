from pydantic import BaseModel


class TurbopufferRecord(BaseModel):
    id: str
    vector: list[float]
    chunk: str
    document: str
    title: str
    url: str
    version: str | None = None
    product: str | None = None
    keywords: list[str] | None = None
    authed: bool | None = None
