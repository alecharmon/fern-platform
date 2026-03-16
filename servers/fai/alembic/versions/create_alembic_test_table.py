"""create alembic_test table to verify migrations run

Revision ID: create_alembic_test
Revises: add_num_deleted_to_reindexing_jobs
Create Date: 2026-03-16 20:53:00.000000

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "create_alembic_test"
down_revision: Union[str, Sequence[str], None] = "add_num_deleted_to_reindexing_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create a no-op test table to verify Alembic migrations run correctly."""
    op.create_table(
        "alembic_test",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    """Drop the test table."""
    op.drop_table("alembic_test")
