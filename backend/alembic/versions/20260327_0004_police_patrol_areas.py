"""Add patrol area fields for police users

Revision ID: 20260327_0004
Revises: 20260327_0003
Create Date: 2026-03-27 01:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260327_0004"
down_revision = "20260327_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("patrol_state", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("patrol_district", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("patrol_city", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("patrol_station", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "patrol_station")
    op.drop_column("users", "patrol_city")
    op.drop_column("users", "patrol_district")
    op.drop_column("users", "patrol_state")
