"""Add live location fields for police users

Revision ID: 20260327_0003
Revises: 20260327_0002
Create Date: 2026-03-27 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260327_0003"
down_revision = "20260327_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("current_latitude", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("current_longitude", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("location_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "location_updated_at")
    op.drop_column("users", "current_longitude")
    op.drop_column("users", "current_latitude")
