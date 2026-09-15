from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel
from src.db.courses.activities import ActivityRead


class LockType(str, Enum):
    PUBLIC = "public"                # anyone, including anonymous, can view
    AUTHENTICATED = "authenticated"  # must be signed in
    RESTRICTED = "restricted"        # legacy value; course content is gated by enrollment (services/courses/locks.py)


class ChapterBase(SQLModel):
    name: str
    description: Optional[str] = ""
    thumbnail_image: Optional[str] = ""
    lock_type: LockType = LockType.PUBLIC
    org_id: int = Field(
        sa_column=Column("org_id", Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    course_id: int = Field(
        sa_column=Column("course_id", Integer, ForeignKey("course.id", ondelete="CASCADE"), index=True)
    )


class Chapter(ChapterBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chapter_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class ChapterRead(ChapterBase):
    id: int
    activities: List[ActivityRead]
    chapter_uuid: str
    creation_date: str
    update_date: str
    extra_metadata: Optional[dict] = None
    # Computed per-request: whether current user is denied access to this chapter's
    # content (and, by cascade, its activities). Metadata (name, thumbnail) is still
    # returned so TOC navigation still renders a lock placeholder.
    is_locked: bool = False
    pass


