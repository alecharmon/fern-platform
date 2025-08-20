from datetime import datetime
from typing import List
from typing import Optional

from pydantic import BaseModel


class DocumentApi(BaseModel):
    document_id: str
    domain: str
    chunk: str
    document: str
    title: Optional[str] = None
    url: Optional[str] = None
    version: Optional[str] = None
    product: Optional[str] = None
    keywords: Optional[List[str]] = None
    authed: Optional[bool] = None
    created_at: datetime
    updated_at: datetime


class IndexDocumentRequest(BaseModel):
    document: str
    chunk: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    version: Optional[str] = None
    product: Optional[str] = None
    keywords: Optional[List[str]] = None
    authed: Optional[bool] = None


class UpdateDocumentRequest(BaseModel):
    document: Optional[str] = None
    chunk: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    version: Optional[str] = None
    product: Optional[str] = None
    keywords: Optional[List[str]] = None
    authed: Optional[bool] = None
