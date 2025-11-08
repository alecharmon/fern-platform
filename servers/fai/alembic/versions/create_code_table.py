"""create code table

Revision ID: create_code_table
Revises: 8e63cf285ea3
Create Date: 2025-11-07 00:00:00.000000

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "create_code_table"
down_revision: Union[str, Sequence[str], None] = "8e63cf285ea3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "code",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("chunk", sa.String(), nullable=False),
        sa.Column("document", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("version", sa.String(), nullable=True),
        sa.Column("product", sa.String(), nullable=True),
        sa.Column("keywords", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("authed", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_code_domain", "code", ["domain"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_code_domain", table_name="code")
    op.drop_table("code")
