import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isEmailAllowed, normalizeEmail } from "@/lib/auth-utils";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)) return true;
  return false;
}

function isAuthenticatedWithAllowedEmail(
  authSession: { user?: { email?: string | null } } | null | undefined,
): boolean {
  if (!authSession) return false;

  const email = normalizeEmail(authSession.user?.email ?? null);
  if (!email) return false;

  return isEmailAllowed(email);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/login") && isAuthenticatedWithAllowedEmail(req.auth)) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  // Let API route handlers return JSON 401 instead of redirecting to /login
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!isAuthenticatedWithAllowedEmail(req.auth)) {
    const loginUrl = new URL("/login", req.nextUrl);
    if (req.auth && !normalizeEmail(req.auth.user?.email ?? null)) {
      loginUrl.searchParams.set("error", "AccessDenied");
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
