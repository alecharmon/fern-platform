"""add decompose_queries column to settings table

Revision ID: add_decompose_queries
Revises: add_subqueries_to_queries
Create Date: 2025-12-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_decompose_queries'
down_revision: Union[str, Sequence[str], None] = 'add_subqueries_to_queries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('settings', sa.Column('decompose_queries', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('settings', 'decompose_queries')
