"""change settings PK to composite (domain, basepath)

Revision ID: composite_pk_domain_basepath
Revises: add_basepath_to_settings
Create Date: 2026-03-14 06:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "composite_pk_domain_basepath"
down_revision: Union[str, Sequence[str], None] = "add_basepath_to_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change PK from domain-only to composite (domain, basepath)."""
    # Convert existing NULL basepaths to empty string
    op.execute("UPDATE settings SET basepath = '' WHERE basepath IS NULL")

    # Make basepath NOT NULL with default ''
    op.alter_column(
        "settings",
        "basepath",
        existing_type=sa.String(),
        nullable=False,
        server_default="",
    )

    # Drop old single-column PK and create composite PK
    op.drop_constraint("settings_pkey", "settings", type_="primary")
    op.create_primary_key("settings_pkey", "settings", ["domain", "basepath"])


def downgrade() -> None:
    """Revert to domain-only PK."""
    op.drop_constraint("settings_pkey", "settings", type_="primary")
    op.create_primary_key("settings_pkey", "settings", ["domain"])

    # Revert basepath to nullable, convert empty strings back to NULL
    op.alter_column(
        "settings",
        "basepath",
        existing_type=sa.String(),
        nullable=True,
        server_default=None,
    )
    op.execute("UPDATE settings SET basepath = NULL WHERE basepath = ''")
