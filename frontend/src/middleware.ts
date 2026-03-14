import { NextRequest, NextResponse } from "next/server";

// Paths that are always allowed through without a setup check
const ALWAYS_ALLOW = ["/setup", "/api/", "/_next/", "/favicon"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let setup page, API calls, and Next.js internals through unconditionally
  if (ALWAYS_ALLOW.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Fast path: if the setup_complete cookie is set, skip the API call
  const setupCookie = request.cookies.get("kk_setup_complete");
  if (setupCookie?.value === "1") {
    return NextResponse.next();
  }

  // No cookie → call the setup status API to check
  try {
    const apiBase =
      process.env.INTERNAL_API_URL ?? // set this in docker-compose for server-to-server
      "http://api:8000";

    const res = await fetch(`${apiBase}/api/setup/status`, {
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const data = await res.json();
      if (!data.setup_complete) {
        // Redirect to setup wizard
        const url = request.nextUrl.clone();
        url.pathname = "/setup";
        return NextResponse.redirect(url);
      }

      // Setup is complete — set the cookie so we skip this check next time
      const response = NextResponse.next();
      response.cookies.set("kk_setup_complete", "1", {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: "lax",
        path: "/",
      });
      return response;
    }
  } catch {
    // API not reachable yet (container starting up) — let the page handle it
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
