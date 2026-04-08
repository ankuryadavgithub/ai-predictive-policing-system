"""Add identity verifications for citizen onboarding

Revision ID: 20260407_0005
Revises: 20260327_0004
Create Date: 2026-04-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260407_0005"
down_revision = "20260327_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "identity_verifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("role", sa.String(length=30), nullable=False, server_default="citizen"),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("gps_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("aadhaar_masked", sa.String(length=20), nullable=True),
        sa.Column("verification_status", sa.String(length=40), nullable=False, server_default="pending_manual_review"),
        sa.Column("ocr_status", sa.String(length=40), nullable=False, server_default="pending"),
        sa.Column("liveness_status", sa.String(length=40), nullable=False, server_default="pending"),
        sa.Column("face_match_score", sa.Float(), nullable=True),
        sa.Column("face_match_status", sa.String(length=40), nullable=False, server_default="pending"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("aadhaar_card_path", sa.String(length=500), nullable=False),
        sa.Column("live_selfie_path", sa.String(length=500), nullable=False),
        sa.Column("liveness_frames_path", sa.String(length=500), nullable=True),
        sa.Column("raw_file_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_identity_verifications_user_id", "identity_verifications", ["user_id"])
    op.create_index("ix_identity_verifications_role", "identity_verifications", ["role"])
    op.create_index("ix_identity_verifications_username", "identity_verifications", ["username"])
    op.create_index("ix_identity_verifications_email", "identity_verifications", ["email"])
    op.create_index("ix_identity_verifications_aadhaar_masked", "identity_verifications", ["aadhaar_masked"])
    op.create_index(
        "ix_identity_verifications_verification_status",
        "identity_verifications",
        ["verification_status"],
    )
    op.create_index("ix_identity_verifications_reviewed_by", "identity_verifications", ["reviewed_by"])


def downgrade() -> None:
    op.drop_index("ix_identity_verifications_reviewed_by", table_name="identity_verifications")
    op.drop_index("ix_identity_verifications_verification_status", table_name="identity_verifications")
    op.drop_index("ix_identity_verifications_aadhaar_masked", table_name="identity_verifications")
    op.drop_index("ix_identity_verifications_email", table_name="identity_verifications")
    op.drop_index("ix_identity_verifications_username", table_name="identity_verifications")
    op.drop_index("ix_identity_verifications_role", table_name="identity_verifications")
    op.drop_index("ix_identity_verifications_user_id", table_name="identity_verifications")
    op.drop_table("identity_verifications")
