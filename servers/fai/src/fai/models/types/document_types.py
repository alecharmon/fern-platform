from datetime import datetime

from pydantic import BaseModel


class Document(BaseModel):
    document_id: str
    domain: str
    chunk: str
    document: str
    title: str | None = None
    url: str | None = None
    version: str | None = None
    product: str | None = None
    keywords: list[str] | None = None
    authed: bool | None = None
    created_at: datetime
    updated_at: datetime
