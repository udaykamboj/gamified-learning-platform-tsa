"""student-centred platform model

Merges the four open heads and applies the schema side of the refactor in
docs/refactor/progress/ (Refactor_Student_Learning_Platform.md):

- playgroundshare: a playground shared with a specific person (R12)
- discussion.board_uuid: a board linked into a community discussion (R13, R14)
- drop usergroup, usergroupuser, usergroupresource: admins no longer grant
  students access to anything (R3)
- drop demoentity: registry of the removed demo-org seeder

Roles need no DDL: the API retires Maintainer/Instructor/custom roles and syncs
the course catalog on boot.

Revision ID: s7t8u9v0w1x2
Revises: n4o5p6q7r8s9, b1c2d3e4f5a6, c1d2e3f4a5b6, d3e4f5a6b7c8
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 's7t8u9v0w1x2'
down_revision: Union[str, Sequence[str], None] = (
    'n4o5p6q7r8s9',
    'b1c2d3e4f5a6',
    'c1d2e3f4a5b6',
    'd3e4f5a6b7c8',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    tables = _tables()

    if "playgroundshare" not in tables:
        op.create_table(
            "playgroundshare",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("playground_id", sa.Integer(), sa.ForeignKey("playground.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
            sa.Column("role", sa.String(), nullable=False, server_default="viewer"),
            sa.Column("creation_date", sa.String(), nullable=False, server_default=""),
            sa.UniqueConstraint("playground_id", "user_id", name="uq_playgroundshare_user"),
        )
        op.create_index("ix_playgroundshare_playground_id", "playgroundshare", ["playground_id"])
        op.create_index("ix_playgroundshare_user_id", "playgroundshare", ["user_id"])

    if "discussion" in tables and "board_uuid" not in _columns("discussion"):
        op.add_column("discussion", sa.Column("board_uuid", sa.String(length=100), nullable=True))
        op.create_index("ix_discussion_board_uuid", "discussion", ["board_uuid"])

    for table in ("usergroupresource", "usergroupuser", "usergroup", "demoentity"):
        if table in tables:
            op.drop_table(table)


def downgrade() -> None:
    tables = _tables()
    if "discussion" in tables and "board_uuid" in _columns("discussion"):
        op.drop_index("ix_discussion_board_uuid", table_name="discussion")
        op.drop_column("discussion", "board_uuid")
    if "playgroundshare" in tables:
        op.drop_table("playgroundshare")
    # Usergroup tables are not recreated: the access-granting model they
    # supported no longer exists in the application.
