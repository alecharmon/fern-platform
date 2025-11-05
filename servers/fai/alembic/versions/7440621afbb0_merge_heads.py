"""merge heads

Revision ID: 7440621afbb0
Revises: 5564af7bb91b, 62afaf912daa
Create Date: 2025-11-04 12:27:13.803792

"""

from typing import (
    Sequence,
    Union,
)

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7440621afbb0"
down_revision: Union[str, Sequence[str], None] = ("5564af7bb91b", "62afaf912daa")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
