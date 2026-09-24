"""agent attachments: photos and PDFs sent to the agent

The agent could only be typed at. People keep invoices as PDFs from their
e-Fatura inbox and as photos on their phone, and "is this one right?" is a
question about the document, not about anything already in the books.

One table for the files and what was read out of them, scoped by
``company_id`` with a cascade from ``companies`` exactly like the other agent
tables, and one column on ``agent_messages`` recording which files rode with
which question.

Revision ID: 0013_agent_attachments
Revises: 0012_agent_conversations
Create Date: 2026-09-24 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013_agent_attachments"
down_revision: Union[str, None] = "0012_agent_conversations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_messages",
        sa.Column(
            "attachment_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )

    op.create_table(
        "agent_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("message_id", sa.String(), nullable=True),
        sa.Column("filename", sa.String(length=255), server_default="", nullable=False),
        sa.Column("content_type", sa.String(length=64), nullable=False),
        sa.Column("size", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("pages", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("pages_read", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("text", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "fields",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "notes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["agent_conversations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agent_attachments_company_id", "agent_attachments", ["company_id"]
    )
    op.create_index(
        "ix_agent_attachments_conversation_id", "agent_attachments", ["conversation_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_agent_attachments_conversation_id", table_name="agent_attachments")
    op.drop_index("ix_agent_attachments_company_id", table_name="agent_attachments")
    op.drop_table("agent_attachments")
    op.drop_column("agent_messages", "attachment_ids")
