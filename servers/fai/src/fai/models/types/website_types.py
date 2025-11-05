from datetime import datetime

from pydantic import BaseModel


class Website(BaseModel):
    website_id: str
    domain: str
    base_url: str
    page_url: str
    chunk: str
    document: str
    title: str | None = None
    version: str | None = None
    product: str | None = None
    keywords: list[str] | None = None
    authed: bool | None = None
    created_at: datetime
    updated_at: datetime
