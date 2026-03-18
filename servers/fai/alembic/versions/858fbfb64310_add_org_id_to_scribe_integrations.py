"""add_org_id_to_scribe_integrations

Revision ID: 858fbfb64310
Revises: create_alembic_test
Create Date: 2026-03-18 10:56:24.187486

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '858fbfb64310'
down_revision: Union[str, Sequence[str], None] = 'create_alembic_test'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("scribe_integrations", sa.Column("org_id", sa.String(), nullable=True))
    op.create_index("ix_scribe_integrations_org_id", "scribe_integrations", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_scribe_integrations_org_id", table_name="scribe_integrations")
    op.drop_column("scribe_integrations", "org_id")
