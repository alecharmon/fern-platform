import hashlib

from typing import List

from openai import AsyncOpenAI
from sqlalchemy import ARRAY
from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import String

from settings import CONFIG
from src.fai.api_models.document import DocumentApi
from src.fai.api_models.tpuf_record import TpufRecordApi
from src.fai.db import Base
from src.fai.utils.document.format_document_for_tpuf import format_document_for_tpuf


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    context = Column(ARRAY(String), nullable=False)
    document = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    def to_api(self) -> DocumentApi:
        return DocumentApi(
            domain=self.domain,
            context=self.context,
            document=self.document,
            document_id=self.document_id,
            is_active=self.is_active,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    async def to_tpuf_record(self, openai_client: AsyncOpenAI) -> List[TpufRecordApi]:
        tbuf_records = []
        for chunk_index, chunk in enumerate(self.context):
            embedding = await openai_client.embeddings.create(
                input=chunk,
                model=CONFIG.DEFAULT_EMBEDDING_MODEL.model_name,
            )
            chunk_vector = embedding.data[0].embedding
            tbuf_records.append(
                TpufRecordApi(
                    id=f"{self.document_id}:{chunk_index}",
                    vector=chunk_vector,
                    chunk=chunk,
                    document=format_document_for_tpuf(chunk, self.document),
                    title="",
                    url="",
                    version=None,
                    keywords=None,
                    authed=None,
                ),
            )
        return tbuf_records
