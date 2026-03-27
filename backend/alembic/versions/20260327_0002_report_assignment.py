"""Add police assignment to crime reports

Revision ID: 20260327_0002
Revises: 20260326_0001
Create Date: 2026-03-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260327_0002"
down_revision = "20260326_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crime_reports",
        sa.Column("assigned_police_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_crime_reports_assigned_police_id", "crime_reports", ["assigned_police_id"])
    op.create_foreign_key(
        "fk_crime_reports_assigned_police_id_users",
        "crime_reports",
        "users",
        ["assigned_police_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_crime_reports_assigned_police_id_users", "crime_reports", type_="foreignkey")
    op.drop_index("ix_crime_reports_assigned_police_id", table_name="crime_reports")
    op.drop_column("crime_reports", "assigned_police_id")
