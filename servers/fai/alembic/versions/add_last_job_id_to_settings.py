"""add last_job_id column to settings table

Revision ID: add_last_job_id
Revises: add_decompose_queries
Create Date: 2026-02-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_last_job_id'
down_revision: Union[str, Sequence[str], None] = 'add_decompose_queries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('settings', sa.Column('last_job_id', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('settings', 'last_job_id')
