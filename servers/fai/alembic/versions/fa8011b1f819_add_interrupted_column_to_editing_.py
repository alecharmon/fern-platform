"""add_status_column_to_editing_sessions

Revision ID: fa8011b1f819
Revises: 461b2caaffc7
Create Date: 2025-10-28 11:14:44.545471

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "fa8011b1f819"
down_revision: Union[str, Sequence[str], None] = "461b2caaffc7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum type for editing session status
    editing_session_status = postgresql.ENUM(
        "waiting", "active", "interrupted", "completed", name="editingsessionstatus", create_type=True
    )
    editing_session_status.create(op.get_bind(), checkfirst=True)

    # Add status column with default value of 'waiting'
    op.add_column(
        "editing_sessions",
        sa.Column("status", editing_session_status, nullable=False, server_default="waiting"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the status column
    op.drop_column("editing_sessions", "status")

    # Drop the enum type
    op.execute("DROP TYPE editingsessionstatus")
