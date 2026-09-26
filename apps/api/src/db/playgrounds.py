from typing import Optional
from enum import Enum
from sqlalchemy import Column, ForeignKey, Integer, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


class PlaygroundAccessType(str, Enum):
    PUBLIC = "public"               # Anyone with the link, including anonymous
    AUTHENTICATED = "authenticated"  # Any signed-in user with the link
    RESTRICTED = "restricted"        # Private: the owner and the people they share it with


class PlaygroundShareRole(str, Enum):
    EDITOR = "editor"  # can generate, rename and edit
    VIEWER = "viewer"  # can open it


class PlaygroundBase(SQLModel):
    name: str
    description: Optional[str] = None
    thumbnail_image: Optional[str] = None
    # Private by default: a playground is the student's own workspace until they
    # share it (docs/refactor/progress/00-requirements.md, R12).
    access_type: PlaygroundAccessType = PlaygroundAccessType.RESTRICTED
    published: bool = False
    course_uuid: Optional[str] = None  # Optional course link (for RAG)
    html_content: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True)
    )


class Playground(PlaygroundBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    playground_uuid: str = Field(default="", index=True)
    course_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="SET NULL"), nullable=True),
    )
    created_by: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    creation_date: str = ""
    update_date: str = ""


class PlaygroundShare(SQLModel, table=True):
    """A playground its owner shared with one specific person."""

    __table_args__ = (UniqueConstraint("playground_id", "user_id", name="uq_playgroundshare_user"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    playground_id: int = Field(
        sa_column=Column(Integer, ForeignKey("playground.id", ondelete="CASCADE"), index=True)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    )
    role: str = Field(default=PlaygroundShareRole.VIEWER)
    creation_date: str = ""


class PlaygroundRead(PlaygroundBase):
    id: int
    org_id: int
    org_uuid: Optional[str] = None
    org_slug: Optional[str] = None
    playground_uuid: str
    course_id: Optional[int] = None
    created_by: Optional[int] = None
    author_username: Optional[str] = None
    author_first_name: Optional[str] = None
    author_last_name: Optional[str] = None
    author_user_uuid: Optional[str] = None
    author_avatar_image: Optional[str] = None
    # The caller's relation to it: "owner", "editor", "viewer" or None (link access).
    my_role: Optional[str] = None
    creation_date: str
    update_date: str


class PlaygroundCreate(SQLModel):
    name: str
    description: Optional[str] = None
    thumbnail_image: Optional[str] = None
    access_type: PlaygroundAccessType = PlaygroundAccessType.RESTRICTED
    course_uuid: Optional[str] = None
    html_content: Optional[str] = None


class PlaygroundUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail_image: Optional[str] = None
    access_type: Optional[PlaygroundAccessType] = None
    published: Optional[bool] = None
    course_uuid: Optional[str] = None
    html_content: Optional[str] = None


class PlaygroundShareCreate(SQLModel):
    # Share by username or email, the way people know each other.
    identifier: str
    role: PlaygroundShareRole = PlaygroundShareRole.VIEWER


class PlaygroundShareRead(SQLModel):
    user_id: int
    role: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_image: Optional[str] = None
    user_uuid: Optional[str] = None
    creation_date: str = ""
