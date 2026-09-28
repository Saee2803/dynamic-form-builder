"""add submission form snapshot

Revision ID: b78f2c4a91e
Revises: 1d97827c48fe
Create Date: 2026-09-28

"""
from alembic import op
import sqlalchemy as sa


revision = "b78f2c4a91e"
down_revision = "1d97827c48fe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("form_submissions", sa.Column("form_snapshot", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("form_submissions", "form_snapshot")