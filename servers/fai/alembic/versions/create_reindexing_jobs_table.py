"""create reindexing_jobs table

Revision ID: create_reindexing_jobs
Revises: add_decompose_queries
Create Date: 2026-03-13 21:00:00.000000

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "create_reindexing_jobs"
down_revision: Union[str, Sequence[str], None] = "add_decompose_queries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "reindexing_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("sqs_message_id", sa.String(), nullable=True),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("basepath", sa.String(), nullable=True),
        sa.Column("force_full_reindex", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status", sa.String(), nullable=False, server_default="queued"),
        sa.Column("memory_mb", sa.Integer(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("task_arn", sa.String(), nullable=True),
        sa.Column("task_arns", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("num_inserted", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("job_total_time_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sqs_message_id"),
    )
    op.create_index("idx_reindexing_jobs_domain", "reindexing_jobs", ["domain"], unique=False)
    op.create_index("idx_reindexing_jobs_status", "reindexing_jobs", ["status"], unique=False)
    op.create_index("idx_reindexing_jobs_task_arn", "reindexing_jobs", ["task_arn"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_reindexing_jobs_task_arn", table_name="reindexing_jobs")
    op.drop_index("idx_reindexing_jobs_status", table_name="reindexing_jobs")
    op.drop_index("idx_reindexing_jobs_domain", table_name="reindexing_jobs")
    op.drop_table("reindexing_jobs")
