from typing import List

from sqlalchemy import ARRAY
from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import String

from src.fai.api_models.document import DocumentApi
from src.fai.api_models.tpuf_record import TpufAttributesApi
from src.fai.api_models.tpuf_record import TpufRecordWithoutVectorApi
from src.fai.db import Base


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

    def to_tpuf_record(self) -> List[TpufRecordWithoutVectorApi]:
        return [
            TpufRecordWithoutVectorApi(
                id=self.document_id,
                attributes=TpufAttributesApi(
                    chunk=chunk,
                    document=self.document,
                    title="",
                    url="",
                    version=None,
                    keywords=None,
                    authed=None,
                ),
            )
            for chunk in self.context
        ]
