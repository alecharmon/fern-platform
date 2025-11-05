"""add_startup_status_to_editing_sessions

Revision ID: af951c45da91
Revises: 1a06a4d351f9
Create Date: 2025-10-31 11:19:09.069432

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "af951c45da91"
down_revision: Union[str, Sequence[str], None] = "1a06a4d351f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add 'STARTUP' value to the editingsessionstatus enum
    op.execute("ALTER TYPE editingsessionstatus ADD VALUE IF NOT EXISTS 'STARTUP'")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL does not support removing enum values easily
    # This would require recreating the enum type, which is complex
    # For now, we'll leave the enum value in place
    pass
