"""add_chunk_count_to_content_hashes

Revision ID: bef764295d1b
Revises: create_content_hashes_table
Create Date: 2025-12-10 16:52:03.487012

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bef764295d1b'
down_revision: Union[str, Sequence[str], None] = 'create_content_hashes_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('content_hashes', sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0', comment='Number of chunks created during indexing'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('content_hashes', 'chunk_count')
