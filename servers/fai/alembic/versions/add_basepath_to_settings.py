"""add basepath column to settings table

Revision ID: add_basepath_to_settings
Revises: enable_rls_reindexing_jobs
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_basepath_to_settings'
down_revision: Union[str, Sequence[str], None] = 'enable_rls_reindexing_jobs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('settings', sa.Column('basepath', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('settings', 'basepath')
