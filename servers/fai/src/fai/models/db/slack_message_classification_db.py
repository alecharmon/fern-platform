from datetime import (
    UTC,
    datetime,
)
from uuid import uuid4

from sqlalchemy import (
    Column,
    DateTime,
    Index,
    String,
    Text,
)

from fai.models.base import Base


class SlackMessageClassificationDb(Base):
    __tablename__ = "slack_message_classification"

    id = Column(String, primary_key=True, nullable=False, default=lambda: str(uuid4()))

    message_ts = Column(String, nullable=False)

    team_id = Column(String, nullable=False)

    classification = Column(String, nullable=False)

    reasoning = Column(Text, nullable=True)

    message_text = Column(Text, nullable=False)

    classified_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    __table_args__ = (
        Index("idx_slack_message_classification_classified_at", "classified_at"),
        Index("idx_slack_message_classification_team_ts", "team_id", "message_ts"),
        Index("idx_slack_message_classification_classification", "classification"),
    )
