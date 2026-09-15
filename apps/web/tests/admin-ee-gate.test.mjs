// Contract tests for the superadmin surface gate.
//
// The StarLab single-org build ships the admin console as CORE: admins land on
// /admin after login in every deployment mode, so the web gate never blocks.
// Security is enforced by the role/permission layer instead — only superadmin
// accounts can reach the /admin API surface (SuperadminAuthorization + the
// backend's _require_platform_superadmin). If someone later re-gates the
// surface for upstream OSS releases, these fail.

import { describe, expect, test } from "bun:test";

// `server-only` is a Next build-time alias rather than an installed package, so
// it has to be stubbed before importing any module that declares it.
import { mock } from "bun:test";
mock.module("server-only", () => ({}));

const { isSuperadminSurfaceBlocked } = await import("../lib/eeGate.ts");

describe("isSuperadminSurfaceBlocked", () => {
  test("never blocks OSS (admin console is core)", () => {
    expect(isSuperadminSurfaceBlocked("oss")).toBe(false);
  });

  test("never blocks SaaS", () => {
    expect(isSuperadminSurfaceBlocked("saas")).toBe(false);
  });

  test("never blocks self-hosted EE", () => {
    expect(isSuperadminSurfaceBlocked("ee")).toBe(false);
  });

  test("fails open when the mode is unknown", () => {
    expect(isSuperadminSurfaceBlocked(null)).toBe(false);
  });
});