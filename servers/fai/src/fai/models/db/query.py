from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Float
from sqlalchemy import String

from src.fai.db import Base
from src.fai.models.api.query import QueryApi


class Query(Base):
    __tablename__ = "queries"
    __table_args__ = {"extend_existing": True}

    query_id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    text = Column(String, nullable=False)
    role = Column(String, nullable=False)
    source = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    time_to_first_token = Column(Float, nullable=True)

    def to_api(self) -> QueryApi:
        return QueryApi(
            query_id=self.query_id,
            conversation_id=self.conversation_id,
            domain=self.domain,
            text=self.text,
            role=self.role,
            source=self.source,
            created_at=self.created_at,
            time_to_first_token=self.time_to_first_token,
        )
