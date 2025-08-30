from openai import AsyncOpenAI
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    String,
)

from src.fai.db import Base
from src.fai.models.db.array_column import ArrayColumn
from src.fai.models.types.document_types import Document
from src.fai.models.utils.record import TurbopufferRecord
from src.settings import CONFIG


class DocumentDb(Base):
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    domain = Column(String, nullable=False)
    chunk = Column(String, nullable=False)
    document = Column(String, nullable=False)
    title = Column(String, nullable=True)
    url = Column(String, nullable=True)
    version = Column(String, nullable=True)
    product = Column(String, nullable=True)
    keywords = Column(ArrayColumn(String), nullable=True)
    authed = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    def to_api(self) -> Document:
        return Document(
            document_id=self.id,
            domain=self.domain,
            chunk=self.chunk,
            document=self.document,
            title=self.title,
            url=self.url,
            version=self.version,
            product=self.product,
            keywords=self.keywords,
            authed=self.authed,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    async def to_tpuf_record(self, openai_client: AsyncOpenAI) -> TurbopufferRecord:
        embedding = await openai_client.embeddings.create(
            input=self.chunk,
            model=CONFIG.DEFAULT_EMBEDDING_MODEL.model_name,
        )
        chunk_vector = embedding.data[0].embedding
        return TurbopufferRecord(
            id=self.id,
            vector=chunk_vector,
            chunk=self.chunk,
            document=self.document,
            title=self.title or "",
            url=self.url or "",
            version=self.version,
            product=self.product,
            keywords=self.keywords,
            authed=self.authed,
        )
