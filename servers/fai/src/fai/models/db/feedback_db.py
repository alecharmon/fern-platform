from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    String,
)

from fai.models.base import Base
from fai.models.types.feedback_types import Feedback


class FeedbackDb(Base):
    __tablename__ = "feedback"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    query_id = Column(String, nullable=False)
    conversation_id = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    is_helpful = Column(Boolean, nullable=False)
    feedback_message = Column(String, nullable=True)
    user_email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)

    def to_api(self) -> Feedback:
        return Feedback(
            query_id=self.query_id,
            conversation_id=self.conversation_id,
            domain=self.domain,
            is_helpful=self.is_helpful,
            feedback_message=self.feedback_message,
            user_email=self.user_email,
            created_at=self.created_at,
        )
