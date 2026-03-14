"""enable RLS on reindexing_jobs table

Revision ID: enable_rls_reindexing_jobs
Revises: create_reindexing_jobs
Create Date: 2026-03-14 05:00:00.000000

"""

from typing import (
    Sequence,
    Union,
)

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "enable_rls_reindexing_jobs"
down_revision: Union[str, Sequence[str], None] = "create_reindexing_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable Row Level Security on reindexing_jobs with no policies (blocks all Data API access)."""
    op.execute("ALTER TABLE reindexing_jobs ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Disable Row Level Security on reindexing_jobs."""
    op.execute("ALTER TABLE reindexing_jobs DISABLE ROW LEVEL SECURITY")
