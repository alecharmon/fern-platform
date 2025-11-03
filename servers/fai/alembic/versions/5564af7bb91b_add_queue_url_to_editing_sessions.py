"""add_queue_url_to_editing_sessions

Revision ID: 5564af7bb91b
Revises: af951c45da91
Create Date: 2025-10-31 12:21:38.371377

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5564af7bb91b"
down_revision: Union[str, Sequence[str], None] = "af951c45da91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add queue_url column to editing_sessions table
    op.add_column("editing_sessions", sa.Column("queue_url", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove queue_url column from editing_sessions table
    op.drop_column("editing_sessions", "queue_url")
