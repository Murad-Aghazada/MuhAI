"""agent conversations, messages and report artifacts

The assistant used to be a stateless question box: ``/api/compute/chat`` took a
message plus a snapshot and returned a string. That cannot hold a follow-up
("and the month before?"), cannot show what it read, and throws away an answer
that cost several tool calls and a model round trip.

These three tables give it a memory, scoped exactly like the workspace: one
``company_id`` column and a cascade from ``companies``, so deleting a company
takes its chat history with it and no query can cross the boundary.

Revision ID: 0012_agent_conversations
Revises: 0011_drop_legacy_tables
Create Date: 2026-09-24 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_agent_conversations"
down_revision: Union[str, None] = "0011_drop_legacy_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _company_fk() -> sa.Column:
    return sa.Column("company_id", postgresql.UUID(as_uuid=False), nullable=False)


def _jsonb_list(name: str) -> sa.Column:
    return sa.Column(
        name,
        postgresql.JSONB(astext_type=sa.Text()),
        server_default=sa.text("'[]'::jsonb"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "agent_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        _company_fk(),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), server_default="Yeni sohbet", nullable=False),
        sa.Column(
            "pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "message_count", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "last_message_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "extra",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agent_conversations_company_id", "agent_conversations", ["company_id"]
    )

    op.create_table(
        "agent_messages",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        _company_fk(),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("role", sa.String(length=16), server_default="user", nullable=False),
        sa.Column("content", sa.Text(), server_default="", nullable=False),
        sa.Column("source", sa.String(length=16), server_default="ai", nullable=False),
        _jsonb_list("blocks"),
        _jsonb_list("tool_calls"),
        _jsonb_list("artifact_ids"),
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
    op.create_index("ix_agent_messages_company_id", "agent_messages", ["company_id"])
    op.create_index(
        "ix_agent_messages_conversation_id", "agent_messages", ["conversation_id"]
    )

    op.create_table(
        "agent_artifacts",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        _company_fk(),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("message_id", sa.String(), nullable=True),
        sa.Column("kind", sa.String(length=32), server_default="report", nullable=False),
        sa.Column("title", sa.String(), server_default="Rapor", nullable=False),
        sa.Column("subtitle", sa.String(), server_default="", nullable=False),
        sa.Column("period", sa.String(), server_default="", nullable=False),
        _jsonb_list("blocks"),
        sa.Column(
            "extra",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
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
    op.create_index("ix_agent_artifacts_company_id", "agent_artifacts", ["company_id"])
    op.create_index(
        "ix_agent_artifacts_conversation_id", "agent_artifacts", ["conversation_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_agent_artifacts_conversation_id", table_name="agent_artifacts")
    op.drop_index("ix_agent_artifacts_company_id", table_name="agent_artifacts")
    op.drop_table("agent_artifacts")

    op.drop_index("ix_agent_messages_conversation_id", table_name="agent_messages")
    op.drop_index("ix_agent_messages_company_id", table_name="agent_messages")
    op.drop_table("agent_messages")

    op.drop_index("ix_agent_conversations_company_id", table_name="agent_conversations")
    op.drop_table("agent_conversations")
