"""Initial security hardening schema

Revision ID: 20260326_0001
Revises:
Create Date: 2026-03-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260326_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("government_id", sa.String(length=100), nullable=True),
        sa.Column("gps_consent", sa.Boolean(), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("badge_id", sa.String(length=100), nullable=True),
        sa.Column("rank", sa.String(length=100), nullable=True),
        sa.Column("station", sa.String(length=255), nullable=True),
        sa.Column("district", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_status", "users", ["status"])

    op.create_table(
        "crimes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("state", sa.String(length=255), nullable=True),
        sa.Column("district", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("crime_type", sa.String(length=255), nullable=True),
        sa.Column("crime_count", sa.Integer(), nullable=True),
        sa.Column("record_type", sa.String(length=20), nullable=False, server_default="historical"),
        sa.Column("prediction_batch", sa.String(length=100), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_crimes_state", "crimes", ["state"])
    op.create_index("ix_crimes_district", "crimes", ["district"])
    op.create_index("ix_crimes_city", "crimes", ["city"])
    op.create_index("ix_crimes_year", "crimes", ["year"])
    op.create_index("ix_crimes_crime_type", "crimes", ["crime_type"])
    op.create_index("ix_crimes_record_type", "crimes", ["record_type"])
    op.create_index(
        "ix_crimes_state_city_year_type_record",
        "crimes",
        ["state", "city", "year", "crime_type", "record_type"],
    )

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("state", sa.String(length=255), nullable=True),
        sa.Column("district", sa.String(length=255), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("predicted_crime_count", sa.Float(), nullable=True),
    )

    op.create_table(
        "crime_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.String(length=20), nullable=False),
        sa.Column("reporter_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("crime_type", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("state", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Submitted"),
        sa.Column("verification_notes", sa.Text(), nullable=True),
        sa.Column("assigned_station", sa.String(length=255), nullable=True),
        sa.Column("assigned_district", sa.String(length=255), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("report_id"),
    )
    op.create_index("ix_crime_reports_report_id", "crime_reports", ["report_id"])
    op.create_index("ix_crime_reports_reporter_user_id", "crime_reports", ["reporter_user_id"])
    op.create_index("ix_crime_reports_status", "crime_reports", ["status"])
    op.create_index("ix_crime_reports_reviewed_by", "crime_reports", ["reviewed_by"])

    op.create_table(
        "evidence_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("crime_reports.id"), nullable=False),
        sa.Column("original_file_name", sa.String(length=255), nullable=False),
        sa.Column("stored_file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_type", sa.String(length=50), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("stored_file_name"),
    )
    op.create_index("ix_evidence_files_report_id", "evidence_files", ["report_id"])


def downgrade() -> None:
    op.drop_index("ix_evidence_files_report_id", table_name="evidence_files")
    op.drop_table("evidence_files")

    op.drop_index("ix_crime_reports_reviewed_by", table_name="crime_reports")
    op.drop_index("ix_crime_reports_status", table_name="crime_reports")
    op.drop_index("ix_crime_reports_reporter_user_id", table_name="crime_reports")
    op.drop_index("ix_crime_reports_report_id", table_name="crime_reports")
    op.drop_table("crime_reports")

    op.drop_table("predictions")

    op.drop_index("ix_crimes_state_city_year_type_record", table_name="crimes")
    op.drop_index("ix_crimes_record_type", table_name="crimes")
    op.drop_index("ix_crimes_crime_type", table_name="crimes")
    op.drop_index("ix_crimes_year", table_name="crimes")
    op.drop_index("ix_crimes_city", table_name="crimes")
    op.drop_index("ix_crimes_district", table_name="crimes")
    op.drop_index("ix_crimes_state", table_name="crimes")
    op.drop_table("crimes")

    op.drop_index("ix_users_status", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
