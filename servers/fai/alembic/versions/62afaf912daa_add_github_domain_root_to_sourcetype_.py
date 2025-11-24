"""add github_domain_root to sourcetype enum

Revision ID: 62afaf912daa
Revises: 1a06a4d351f9
Create Date: 2025-10-31 15:57:27.275237

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "62afaf912daa"
down_revision: Union[str, Sequence[str], None] = "1a06a4d351f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add 'GITHUB_DOMAIN_ROOT' value to the sourcetype enum (uppercase to match existing pattern)
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'GITHUB_DOMAIN_ROOT'")


def downgrade() -> None:
    """Downgrade schema."""
    # Note: PostgreSQL doesn't support removing enum values directly
    # You would need to recreate the enum type if you need to downgrade
    pass
