import { describe, it, expect } from "vitest";

// Extract the route classification logic for testing.
// The middleware itself uses Next.js request objects, but the
// path classification logic is pure and testable.

const publicPaths = [
  "/login",
  "/api/v1/auth",
  "/api/v1/ingest",
  "/api/v1/health",
  "/api/auth",
  "/shared",
];

const protectedApiPaths = [
  "/api/v1/live",
  "/api/v1/runs",
  "/api/v1/history",
  "/api/v1/workspaces",
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isProtectedApiPath(pathname: string): boolean {
  return protectedApiPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/v1/auth",
    "/api/v1/auth/register",
    "/api/v1/auth/me",
    "/api/v1/ingest",
    "/api/v1/ingest/hook",
    "/api/v1/health",
    "/api/auth",
    "/api/auth/callback/google",
    "/shared",
    "/shared/some-link-id",
  ])("allows %s as public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/live",
    "/history",
    "/runs/abc-123",
    "/api/v1/live",
    "/api/v1/runs/abc",
    "/api/v1/history",
    "/settings",
    "/",
  ])("does not allow %s as public", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("isProtectedApiPath", () => {
  it.each([
    "/api/v1/live",
    "/api/v1/runs",
    "/api/v1/runs/abc-123",
    "/api/v1/history",
    "/api/v1/workspaces",
    "/api/v1/workspaces/ws-123/members",
  ])("protects %s", (path) => {
    expect(isProtectedApiPath(path)).toBe(true);
  });

  it.each([
    "/api/v1/auth/register",
    "/api/v1/ingest/hook",
    "/api/v1/health",
    "/login",
    "/live",
  ])("does not protect %s", (path) => {
    expect(isProtectedApiPath(path)).toBe(false);
  });
});

describe("isStaticAsset", () => {
  it.each([
    "/_next/static/chunk.js",
    "/_next/image/photo.jpg",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ])("identifies %s as static", (path) => {
    expect(isStaticAsset(path)).toBe(true);
  });

  it.each(["/live", "/api/v1/runs", "/login", "/"])("does not identify %s as static", (path) => {
    expect(isStaticAsset(path)).toBe(false);
  });
});
