"""add num_deleted to reindexing_jobs

Revision ID: add_num_deleted_to_reindexing_jobs
Revises: simplify_reindexing_pipeline
Create Date: 2026-03-16 15:00:00.000000

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_num_deleted_to_reindexing_jobs"
down_revision: Union[str, Sequence[str], None] = "simplify_reindexing_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add num_deleted column to reindexing_jobs table."""
    op.add_column("reindexing_jobs", sa.Column("num_deleted", sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove num_deleted column from reindexing_jobs table."""
    op.drop_column("reindexing_jobs", "num_deleted")
