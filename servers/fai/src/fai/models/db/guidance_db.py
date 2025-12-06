from openai import AsyncOpenAI
from sqlalchemy import (
    Column,
    DateTime,
    String,
)

from fai.db import Base
from fai.models.db.utils.array_column import ArrayColumn
from fai.models.types.guidance_types import Guidance
from fai.models.utils.record import TurbopufferRecord
from fai.settings import CONFIG


def format_guidance_for_tpuf(chunk: str, document: str) -> str:
    return (
        "<GUIDANCE>\n"
        f"In response to the following query:\n{chunk}\n\n"
        f"You will return an answer based on the following guidance:\n{document}\n"
        "</GUIDANCE>"
    )


class GuidanceDb(Base):
    __tablename__ = "guidances"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    domain = Column(String, nullable=False)
    context = Column(ArrayColumn(String), nullable=False)
    document = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    def to_api(self) -> Guidance:
        return Guidance(
            guidance_id=self.id,
            domain=self.domain,
            context=self.context,
            document=self.document,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    async def to_tpuf_record(self, openai_client: AsyncOpenAI) -> list[TurbopufferRecord]:
        tbuf_records = []
        for chunk_index, chunk in enumerate(self.context):
            embedding = await openai_client.embeddings.create(
                input=chunk,
                model=CONFIG.DEFAULT_EMBEDDING_MODEL.model_name,
            )
            chunk_vector = embedding.data[0].embedding
            tbuf_records.append(
                TurbopufferRecord(
                    id=f"{self.id}:{chunk_index}",
                    vector=chunk_vector,
                    chunk=chunk,
                    document=format_guidance_for_tpuf(chunk, self.document),
                    title="",
                    url="",
                    version=None,
                    keywords=None,
                    authed=None,
                    content_type="guidance",
                ),
            )
        return tbuf_records
