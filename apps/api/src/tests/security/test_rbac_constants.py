"""
Tests for RBAC Role Constants

This module tests the role constants and helper functions used throughout
the RBAC system to ensure consistency and correctness.
"""

from src.security.rbac.constants import (ADMIN_ROLE_ID, ADMIN_ROLE_IDS, is_admin)


class TestRoleConstants:
    """Test cases for role ID constants."""

    def test_admin_role_id_value(self):
        """Test that ADMIN_ROLE_ID has the expected value."""
        assert ADMIN_ROLE_ID == 1


    def test_admin_role_ids_contains_admin(self):
        """Test that ADMIN_ROLE_IDS contains the admin role."""
        assert ADMIN_ROLE_ID in ADMIN_ROLE_IDS
        assert len(ADMIN_ROLE_IDS) == 1


class TestRoleHelperFunctions:
    """Test cases for role helper functions."""

    def test_is_admin_with_admin_role(self):
        """Test is_admin returns True for admin role."""
        assert is_admin(ADMIN_ROLE_ID) is True


    def test_is_admin_with_member_role(self):
        """Test is_admin returns False for member roles."""
        assert is_admin(3) is False
        assert is_admin(4) is False
        assert is_admin(100) is False


