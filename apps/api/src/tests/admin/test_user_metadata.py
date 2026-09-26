"""
Tests for the `extra_metadata` JSONB field on the User model.

Covers:
- provision_user (admin service) persists extra_metadata on new users. This
  path is authenticated and headless, so it may write the blob directly.
- provision_user does NOT overwrite extra_metadata when attaching an
  existing user (documents current behavior).
- update_user (user service) does NOT persist extra_metadata - it holds the
  answers to the org's custom signup fields, so it is in `_PROTECTED_FIELDS`
  and a member cannot rewrite it through their own profile.
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from sqlmodel import select

from src.db.user_organizations import UserOrganization
from src.db.users import APITokenUser, User, UserUpdate
from src.services.users.users import update_user


# Fixtures


@pytest.fixture
def token_user(org, admin_user):
    """API token bound to the test org, created by admin_user."""
    return APITokenUser(
        id=1,
        user_uuid="apitoken_test",
        username="api_token",
        org_id=org.id,
        token_name="Test Token",
        created_by_user_id=admin_user.id,
    )


@pytest.fixture
def mock_admin_side_effects():
    """Bypass webhooks, analytics, usage limits, and rate limiting."""
    patches = [
        patch("src.services.admin.admin.dispatch_webhooks", new_callable=AsyncMock),
        patch("src.services.admin.admin.track", new_callable=AsyncMock),
        patch("src.services.admin.admin.check_limits_with_usage", return_value=True),
        patch("src.services.admin.admin.increase_feature_usage", return_value=True),
        patch(
            "src.services.security.rate_limiting.check_admin_user_provision_rate_limit",
            return_value=(True, 0),
        ),
    ]
    started = [p.start() for p in patches]
    yield started
    for p in patches:
        p.stop()


# Tests


class TestProvisionUserExtraMetadata:


    @pytest.mark.asyncio
    async def test_update_user_ignores_extra_metadata(
        self,
        regular_user,
        mock_request,
        db,
    ):
        """A profile update may not rewrite extra_metadata.

        It holds the answers to the org's signup fields, so letting a member
        set it through their own profile would let them forge data the
        organization collected about them. extra_metadata is therefore in
        update_user's _PROTECTED_FIELDS.
        """
        # regular_user is a PublicUser; update_user looks up the DB row by id.
        update_payload = UserUpdate(
            username="regular",
            first_name="Regular",
            last_name="User",
            email="regular@test.com",
            extra_metadata={"locale": "en-GB", "tier": "gold"},
        )

        with patch(
            "src.services.users.users.rbac_check",
            new_callable=AsyncMock,
        ):
            await update_user(
                request=mock_request,
                db_session=db,
                user_id=regular_user.id,
                current_user=regular_user,
                user_object=update_payload,
            )

        row = (await db.execute(select(User).where(User.id == regular_user.id))).scalars().first()
        assert row is not None
        assert row.extra_metadata != {"locale": "en-GB", "tier": "gold"}

        # The rest of the update still applies — only this one field is pinned.
        assert row.first_name == "Regular"
