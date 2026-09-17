"""
RBAC Role Constants

This module defines role ID constants used throughout the RBAC system.
Using constants instead of magic numbers improves code maintainability and clarity.

Role Hierarchy:
    ADMIN (1) - Full access to all resources and organization management
    MAINTAINER (2) - Can manage content but limited org-level permissions
    INSTRUCTOR (3) - Authors their own courses
    USER (4) - The student role every public signup receives
"""

# Core role IDs - these match the database seed data
ADMIN_ROLE_ID = 1
MAINTAINER_ROLE_ID = 2
INSTRUCTOR_ROLE_ID = 3
USER_ROLE_ID = 4

# The role public signup assigns: a student account (see src/security/platform_roles.py).
STUDENT_ROLE_ID = USER_ROLE_ID

# Role ID sets for common checks
ADMIN_ROLE_IDS = frozenset([ADMIN_ROLE_ID])
ADMIN_OR_MAINTAINER_ROLE_IDS = frozenset([ADMIN_ROLE_ID, MAINTAINER_ROLE_ID])
PLATFORM_ROLE_IDS = frozenset([ADMIN_ROLE_ID, USER_ROLE_ID])


def is_admin(role_id: int) -> bool:
    """Check if the role ID is an admin role."""
    return role_id == ADMIN_ROLE_ID


def is_admin_or_maintainer(role_id: int) -> bool:
    """Check if the role ID is an admin or maintainer role."""
    return role_id in ADMIN_OR_MAINTAINER_ROLE_IDS


def has_elevated_privileges(role_id: int) -> bool:
    """
    Check if the role has elevated privileges.

    Elevated privileges include admin and maintainer roles.
    """
    return role_id in ADMIN_OR_MAINTAINER_ROLE_IDS
