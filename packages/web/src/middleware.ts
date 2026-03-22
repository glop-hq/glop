import { NextRequest, NextResponse } from "next/server";

const publicPaths = [
  "/login",
  "/api/v1/auth",
  "/api/v1/cli",
  "/api/v1/ingest",
  "/api/v1/health",
  "/api/v1/repos",
  "/api/v1/facets",
  "/api/v1/shared",
  "/api/v1/join",
  "/api/auth",
  "/shared",
  "/runs",
  "/terms",
  "/privacy",
];

const protectedApiPaths = [
  "/api/v1/live",
  "/api/v1/runs",
  "/api/v1/history",
  "/api/v1/workspaces",
];

// Matches /api/v1/runs/{uuid} but not deeper sub-routes like /api/v1/runs/{uuid}/share
const API_RUN_DETAIL_RE = /^\/api\/v1\/runs\/[^/]+$/;
// CLI-facing routes that use API key auth (not session cookies)
const API_RUN_CLI_RE = /^\/api\/v1\/runs\/[^/]+\/context$/;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (API_RUN_DETAIL_RE.test(pathname)) return true;
  if (API_RUN_CLI_RE.test(pathname)) return true;
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isProtectedApiPath(pathname: string): boolean {
  return protectedApiPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Lightweight cookie check for auth
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    // API routes return 401
    if (isProtectedApiPath(pathname)) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    const callbackUrl = request.nextUrl.search
      ? `${pathname}${request.nextUrl.search}`
      : pathname;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
