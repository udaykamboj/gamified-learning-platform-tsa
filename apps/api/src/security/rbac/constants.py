"""
RBAC Role Constants

StarLab has exactly two account types (docs/refactor/progress/00-requirements.md,
R1/R2). There is no teacher layer: no Maintainer, Instructor or custom staff
roles.

Roles:
    ADMIN (1) - Platform administration, monitoring and community moderation
    USER (4)  - The student role every public signup receives
"""

# Core role IDs - these match the database seed data
ADMIN_ROLE_ID = 1
USER_ROLE_ID = 4

# The role public signup assigns: a student account (see src/security/platform_roles.py).
STUDENT_ROLE_ID = USER_ROLE_ID

# Role ID sets for common checks
ADMIN_ROLE_IDS = frozenset([ADMIN_ROLE_ID])

# The only roles that may exist. Anything else is a retired teacher-era role
# (see `cli.py retire-teacher-roles`).
PLATFORM_ROLE_IDS = frozenset([ADMIN_ROLE_ID, USER_ROLE_ID])


def is_admin(role_id: int) -> bool:
    """Check if the role ID is the admin role."""
    return role_id == ADMIN_ROLE_ID
