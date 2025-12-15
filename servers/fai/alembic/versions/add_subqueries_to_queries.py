"""add subqueries column to queries table

Revision ID: add_subqueries_to_queries
Revises: bef764295d1b
Create Date: 2025-12-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'add_subqueries_to_queries'
down_revision: Union[str, Sequence[str], None] = 'bef764295d1b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('queries', sa.Column('subqueries', postgresql.ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('queries', 'subqueries')
