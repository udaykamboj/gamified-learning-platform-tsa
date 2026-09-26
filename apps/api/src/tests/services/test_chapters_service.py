"""Tests for src/services/courses/chapters.py."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.courses.activities import Activity, ActivityLockType, ActivityRead, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import (Chapter, ChapterRead, LockType)
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.services.courses.chapters import (DEPRECEATED_get_course_chapters, _apply_locks_to_chapters, get_chapter, get_course_chapters)


class TestGetChapter:
    @pytest.mark.asyncio
    async def test_get_chapter_missing_course_raises(
        self, db, chapter, admin_user, mock_request
    ):
        chapter.course_id = 999
        db.add(chapter)
        await db.commit()

        with pytest.raises(HTTPException) as exc_info:
            await get_chapter(mock_request, chapter.id, admin_user, db)

        assert exc_info.value.status_code == 404
        assert "Course does not exist" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_chapter_missing_chapter_raises(
        self, db, admin_user, mock_request
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_chapter(mock_request, 9999, admin_user, db)

        assert exc_info.value.status_code == 404
        assert "Chapter does not exist" in exc_info.value.detail


class TestCourseChapters:
    @pytest.mark.asyncio
    async def test_get_course_chapters_slim_full_and_deprecated_paths(
        self, db, course, chapter, activity, admin_user, mock_request
    ):
        second_chapter = Chapter(
            name="Second Chapter",
            description="",
            thumbnail_image="",
            org_id=course.org_id,
            course_id=course.id,
            chapter_uuid="chapter_second",
            creation_date="2024-01-01",
            update_date="2024-01-01",
        )
        db.add(second_chapter)
        await db.commit()
        await db.refresh(second_chapter)

        db.add(
            CourseChapter(
                chapter_id=second_chapter.id,
                course_id=course.id,
                org_id=course.org_id,
                order=2,
                creation_date="2024-01-01",
                update_date="2024-01-01",
            )
        )
        await db.commit()

        second_activity = Activity(
            name="Second Activity",
            activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            content={"body": "content"},
            details=None,
            published=False,
            org_id=course.org_id,
            course_id=course.id,
            activity_uuid="activity_second",
            creation_date="2024-01-01",
            update_date="2024-01-01",
            current_version=1,
            last_modified_by_id=admin_user.id,
        )
        db.add(second_activity)
        await db.commit()
        await db.refresh(second_activity)

        # Link second_activity to second_chapter (chapter+activity link is set
        # up by the `activity` fixture). The unique constraint on
        # (chapter_id, activity_id) prevents truly-duplicate inserts.
        db.add(
            ChapterActivity(
                chapter_id=second_chapter.id,
                activity_id=second_activity.id,
                course_id=course.id,
                org_id=course.org_id,
                order=0,
                creation_date="2024-01-01",
                update_date="2024-01-01",
            )
        )
        await db.commit()

        slim_result = await get_course_chapters(
            mock_request,
            course.id,
            db,
            admin_user,
            with_unpublished_activities=False,
            slim=True,
            course=course,
        )
        full_result = await get_course_chapters(
            mock_request,
            course.id,
            db,
            admin_user,
            with_unpublished_activities=True,
            slim=False,
            course=course,
        )

        assert len(slim_result) == 2
        assert len(full_result) == 2
        assert slim_result[0].activities[0].activity_uuid == activity.activity_uuid
        assert full_result[0].activities[0].activity_uuid == activity.activity_uuid
        assert full_result[1].activities[0].activity_uuid == second_activity.activity_uuid

        courseless = await get_course_chapters(
            mock_request,
            course.id,
            db,
            admin_user,
            with_unpublished_activities=False,
            slim=False,
        )
        assert len(courseless) == 2

        with patch(
            "src.services.courses.chapters.get_course_chapters",
            new_callable=AsyncMock,
            return_value=[
                SimpleNamespace(
                    chapter_uuid=chapter.chapter_uuid,
                    id=chapter.id,
                    name=chapter.name,
                    activities=[SimpleNamespace(activity_uuid=activity.activity_uuid)],
                )
            ],
        ):
            legacy_result = await DEPRECEATED_get_course_chapters(
                mock_request,
                course.course_uuid,
                admin_user,
                db,
            )
        assert legacy_result["chapterOrder"][0] == chapter.chapter_uuid
        assert activity.activity_uuid in legacy_result["activities"]

    @pytest.mark.asyncio
    async def test_get_course_chapters_missing_course_raises_404(
        self, db, admin_user, mock_request
    ):
        # chapters.py:251 - when no `course` is supplied and the course_id does
        # not exist, the lookup returns None and the function must raise a clean
        # 404 instead of dereferencing None (which would 500).
        with pytest.raises(HTTPException) as exc_info:
            await get_course_chapters(
                mock_request,
                999999,
                db,
                admin_user,
                with_unpublished_activities=False,
            )

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_deprecated_get_course_chapters_missing_course_raises(
        self, db, admin_user, mock_request
    ):
        with pytest.raises(HTTPException) as exc_info:
            await DEPRECEATED_get_course_chapters(
                mock_request, "missing-course", admin_user, db
            )

        assert exc_info.value.status_code == 404
        assert "Course does not exist" in exc_info.value.detail


class TestApplyLocksToChapters:
    def _make_chapter_read(self, chapter_uuid: str, lock_type: LockType, activities=None) -> ChapterRead:
        return ChapterRead(
            id=1,
            name="Test Chapter",
            description="desc",
            thumbnail_image="thumb.png",
            org_id=1,
            course_id=1,
            chapter_uuid=chapter_uuid,
            lock_type=lock_type,
            activities=activities or [],
            creation_date="2024-01-01",
            update_date="2024-01-01",
        )

    def _make_activity_read(self, activity_uuid: str, lock_type: ActivityLockType) -> ActivityRead:
        return ActivityRead(
            id=1,
            name="Test Activity",
            activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            content={"body": "secret"},
            details={"key": "val"},
            published=True,
            lock_type=lock_type,
            org_id=1,
            course_id=1,
            activity_uuid=activity_uuid,
            creation_date="2024-01-01",
            update_date="2024-01-01",
        )

    @pytest.mark.asyncio
    async def test_anonymous_user_locked_out_of_restricted_chapters(
        self, db, course, anonymous_user
    ):
        """Lines 394-398, 420-422, 440-442: restricted lock_type → uuid collected;
        anonymous user → chapter+activity locked and content stripped."""
        activity = self._make_activity_read("act_restricted", ActivityLockType.RESTRICTED)
        chapter = self._make_chapter_read(
            "ch_restricted", LockType.RESTRICTED, activities=[activity]
        )

        await _apply_locks_to_chapters([chapter], course, anonymous_user, db)

        assert chapter.is_locked is True
        assert chapter.description == ""
        assert chapter.thumbnail_image == ""
        assert activity.is_locked is True
        assert activity.content == {}
        assert activity.details is None


    @pytest.mark.asyncio
    async def test_get_course_chapters_dedup_slim_and_full(
        self, db, course, chapter, activity, admin_user, mock_request
    ):
        """Cover lines 313 (slim dedup) and 351 (full dedup) by injecting duplicate rows."""
        from unittest.mock import MagicMock

        original_execute = db.execute

        # slim=True path → line 313
        slim_call = {"n": 0}
        dup_row = (
            chapter.id, activity.id, activity.org_id, activity.course_id,
            activity.name, activity.activity_type, activity.activity_sub_type,
            activity.activity_uuid, activity.published,
            activity.creation_date, activity.update_date,
            1, None, activity.lock_type, 1,
        )
        async def execute_with_slim_dupes(statement):
            slim_call["n"] += 1
            if slim_call["n"] == 2:  # activity query is second execute call
                result = MagicMock()
                result.all.return_value = [dup_row, dup_row]
                return result
            return await original_execute(statement)

        with patch("src.services.courses.chapters.check_resource_access", new_callable=AsyncMock):
            with patch.object(db, "execute", side_effect=execute_with_slim_dupes):
                slim_result = await get_course_chapters(
                    mock_request, course.id, db, admin_user,
                    with_unpublished_activities=True, slim=True, course=course,
                )
        assert len(slim_result[0].activities) == 1

        # slim=False path → line 351
        full_call = {"n": 0}
        async def execute_with_full_dupes(statement):
            full_call["n"] += 1
            if full_call["n"] == 2:  # activity query is second execute call
                ca_mock = MagicMock()
                ca_mock.chapter_id = chapter.id
                result = MagicMock()
                result.all.return_value = [(ca_mock, activity), (ca_mock, activity)]
                return result
            return await original_execute(statement)

        with patch("src.services.courses.chapters.check_resource_access", new_callable=AsyncMock):
            with patch.object(db, "execute", side_effect=execute_with_full_dupes):
                full_result = await get_course_chapters(
                    mock_request, course.id, db, admin_user,
                    with_unpublished_activities=True, slim=False, course=course,
                )
        assert len(full_result[0].activities) == 1
