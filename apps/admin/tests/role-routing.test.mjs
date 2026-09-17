// Contract tests for the single-org role model: a user is either an admin
// (superadmin or a member whose role grants dashboard access) or a student.
// The role decides post-login routing (`/admin` vs `/dashboard`).

import { describe, expect, test } from "bun:test";

import {
  getUserRole,
  isAdminUser,
  postAuthHomePath,
  resolveLandingDestination,
} from "../services/auth/roles.ts";
import { safeRedirectUrl } from "../services/auth/redirects.ts";

const superadminSession = {
  data: { user: { is_superadmin: true }, roles: [] },
};
const adminMemberSession = {
  data: {
    user: { is_superadmin: false },
    roles: [{ role: { rights: { dashboard: { action_access: true } } } }],
  },
};
const studentSession = {
  data: {
    user: { is_superadmin: false },
    roles: [{ role: { rights: { dashboard: { action_access: false } } } }],
  },
};
const anonymous = null;
const loadingSession = { status: "loading" };

describe("getUserRole", () => {
  test("a superadmin is always an admin", () => {
    expect(getUserRole(superadminSession)).toBe("admin");
  });

  test("a member with dashboard.action_access is an admin", () => {
    expect(getUserRole(adminMemberSession)).toBe("admin");
  });

  test("everyone else is a student", () => {
    expect(getUserRole(studentSession)).toBe("student");
  });

  test("plain string roles from dev/test mocks resolve as admins", () => {
    expect(
      getUserRole({ data: { user: {}, roles: [{ role: "admin" }] } }),
    ).toBe("admin");
  });

  test("null while unauthenticated or unloaded", () => {
    expect(getUserRole(anonymous)).toBeNull();
    expect(getUserRole(loadingSession)).toBeNull();
  });
});

describe("postAuthHomePath", () => {
  test("admins land on the admin console", () => {
    expect(postAuthHomePath(superadminSession)).toBe("/admin");
    expect(postAuthHomePath(adminMemberSession)).toBe("/admin");
  });

  test("students land on the dashboard", () => {
    expect(postAuthHomePath(studentSession)).toBe("/dashboard");
  });
});

describe("resolveLandingDestination", () => {
  test("platform defaults are replaced by the role-aware landing", () => {
    expect(resolveLandingDestination("/dashboard", superadminSession)).toBe("/admin");
    expect(resolveLandingDestination("/home", studentSession)).toBe("/dashboard");
    expect(resolveLandingDestination("/", adminMemberSession)).toBe("/admin");
  });

  test("an explicit deep link is honored unchanged", () => {
    const deep = "/orgs/acme/course/xyz";
    expect(resolveLandingDestination(deep, superadminSession)).toBe(deep);
  });

  test("the /redirect_from_auth ?next wrapper is unwrapped for defaults", () => {
    const bridge = "/redirect_from_auth?next=%2Fdashboard";
    expect(resolveLandingDestination(bridge, superadminSession)).toBe("/admin");
  });

  test("the /redirect_from_auth wrapper still forwards deep links", () => {
    const bridge = "/redirect_from_auth?next=%2Forgs%2Facme%2Fcourse%2Fxyz";
    expect(resolveLandingDestination(bridge, studentSession)).toBe(bridge);
  });

  test("empty callback falls back to the role landing", () => {
    expect(resolveLandingDestination("", studentSession)).toBe("/dashboard");
  });
});

describe("role landings are safe navigation targets", () => {
  for (const session of [superadminSession, adminMemberSession, studentSession]) {
    test(`/admin and /dashboard stay same-origin for ${getUserRole(session)}`, () => {
      const landing = postAuthHomePath(session);
      expect(safeRedirectUrl(landing)).not.toBe("#");
      expect(safeRedirectUrl(landing).startsWith("/")).toBe(true);
    });
  }
});