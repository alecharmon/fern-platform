from openai import AsyncOpenAI
from sqlalchemy import (
    Column,
    DateTime,
    String,
)

from fai.models.base import Base
from fai.models.types.slack_context_types import SlackContext
from fai.models.utils.record import TurbopufferRecord
from fai.settings import CONFIG


def format_slack_context_for_tpuf(question: str, ideal_response: str) -> str:
    return (
        "<SLACK_CONTEXT>\n"
        f"In response to the following query:\n{question}\n\n"
        f"You will return an answer based on the following slack context:\n{ideal_response}\n"
        "</SLACK_CONTEXT>"
    )


class SlackContextDb(Base):
    __tablename__ = "slack_contexts"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    domain = Column(String, nullable=False)
    question = Column(String, nullable=False)
    ideal_response = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    def to_api(self) -> SlackContext:
        return SlackContext(
            slack_context_id=self.id,
            domain=self.domain,
            question=self.question,
            ideal_response=self.ideal_response,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    async def to_tpuf_record(self, openai_client: AsyncOpenAI) -> TurbopufferRecord:
        embedding = await openai_client.embeddings.create(
            input=self.question,
            model=CONFIG.DEFAULT_EMBEDDING_MODEL.model_name,
        )
        chunk_vector = embedding.data[0].embedding
        return TurbopufferRecord(
            id=self.id,
            vector=chunk_vector,
            chunk=self.question,
            document=format_slack_context_for_tpuf(self.question, self.ideal_response),
            title="",
            url="",
            version=None,
            product=None,
            keywords=None,
            authed=None,
            content_type="slack_context",
        )
