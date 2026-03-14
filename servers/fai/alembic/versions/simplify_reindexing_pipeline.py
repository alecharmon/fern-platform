"""simplify reindexing pipeline

Drop reindexing_metadata table, settings.job_id column,
and reindexing_jobs.task_arn / duration_ms columns.

Revision ID: simplify_reindexing_pipeline
Revises: composite_pk_domain_basepath
Create Date: 2026-03-14 17:00:00.000000

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "simplify_reindexing_pipeline"
down_revision: Union[str, Sequence[str], None] = "composite_pk_domain_basepath"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Simplify reindexing pipeline schema."""
    # 1. Drop the legacy reindexing_metadata table
    op.execute("DROP INDEX IF EXISTS idx_reindexing_metadata_status")
    op.execute("DROP INDEX IF EXISTS idx_reindexing_metadata_task_arn")
    op.execute("DROP TABLE IF EXISTS reindexing_metadata")

    # 2. Drop job_id column from settings (no longer used for reindex tracking)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'settings' AND column_name = 'job_id'
            ) THEN
                ALTER TABLE settings DROP COLUMN job_id;
            END IF;
        END $$;
    """)

    # 3. Drop redundant columns from reindexing_jobs
    op.execute("DROP INDEX IF EXISTS idx_reindexing_jobs_task_arn")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'reindexing_jobs' AND column_name = 'task_arn'
            ) THEN
                ALTER TABLE reindexing_jobs DROP COLUMN task_arn;
            END IF;
        END $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'reindexing_jobs' AND column_name = 'duration_ms'
            ) THEN
                ALTER TABLE reindexing_jobs DROP COLUMN duration_ms;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Restore dropped tables and columns."""
    # 3. Restore reindexing_jobs columns
    op.add_column("reindexing_jobs", sa.Column("duration_ms", sa.Integer(), nullable=True))
    op.add_column("reindexing_jobs", sa.Column("task_arn", sa.String(), nullable=True))
    op.create_index("idx_reindexing_jobs_task_arn", "reindexing_jobs", ["task_arn"], unique=False)

    # 2. Restore job_id column on settings
    op.add_column("settings", sa.Column("job_id", sa.String(), nullable=True))

    # 1. Restore reindexing_metadata table
    op.create_table(
        "reindexing_metadata",
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("memory_mb", sa.Integer(), nullable=False),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("task_arn", sa.String(), nullable=True),
        sa.Column("sqs_message_id", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("num_inserted", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("task_arns", sa.ARRAY(sa.String()), nullable=True),
        sa.PrimaryKeyConstraint("domain"),
    )
    op.create_index("idx_reindexing_metadata_task_arn", "reindexing_metadata", ["task_arn"], unique=False)
    op.create_index("idx_reindexing_metadata_status", "reindexing_metadata", ["status"], unique=False)
