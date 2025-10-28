"""create index_sources table

Revision ID: 2d743e49aaa1
Revises: fa8011b1f819
Create Date: 2025-10-28 18:00:00.000000

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2d743e49aaa1"
down_revision: Union[str, Sequence[str], None] = "fa8011b1f819"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum types
    source_type_enum = postgresql.ENUM("website", "github", name="sourcetype", create_type=True)
    source_type_enum.create(op.get_bind(), checkfirst=True)

    index_source_status_enum = postgresql.ENUM(
        "active", "indexing", "failed", "paused", name="indexsourcestatus", create_type=True
    )
    index_source_status_enum.create(op.get_bind(), checkfirst=True)

    # Create index_sources table
    op.create_table(
        "index_sources",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("source_type", source_type_enum, nullable=False),
        sa.Column("source_identifier", sa.String(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("last_indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("job_id", sa.String(), nullable=True),
        sa.Column("status", index_source_status_enum, nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    op.create_index(op.f("ix_index_sources_domain"), "index_sources", ["domain"], unique=False)
    op.create_index(op.f("ix_index_sources_source_type"), "index_sources", ["source_type"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index(op.f("ix_index_sources_source_type"), table_name="index_sources")
    op.drop_index(op.f("ix_index_sources_domain"), table_name="index_sources")

    # Drop table
    op.drop_table("index_sources")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS indexsourcestatus")
    op.execute("DROP TYPE IF EXISTS sourcetype")
