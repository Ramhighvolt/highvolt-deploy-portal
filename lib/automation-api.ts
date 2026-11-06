import "server-only";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/require-api-auth";
import { isSameOriginRequest } from "@/lib/security-policy";
import { isSuiteId, type SuiteId } from "@/lib/automation-catalog";

const NO_STORE = { "Cache-Control": "no-store" };

export function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: NO_STORE });
}

export function jsonOk(data: Record<string, unknown>) {
  return NextResponse.json({ success: true, ...data }, { headers: NO_STORE });
}

/** Auth for every automation route; writes additionally need same-origin. */
export async function guard(request: Request, write: boolean) {
  const { session, response } = await requireApiAuth();
  if (response) return { error: response, session: null };
  if (
    write &&
    !isSameOriginRequest(
      request.url,
      request.headers.get("origin"),
      request.headers.get("sec-fetch-site"),
    )
  ) {
    return { error: jsonError("Same-origin request required", 403), session: null };
  }
  return { error: null, session };
}

export function parseSuite(value: string | null): SuiteId | null {
  return isSuiteId(value) ? value : null;
}

export function parseId(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,15}$/.test(value)) return null;
  return Number(value);
}

/** Never leak the token or internals; GitHub errors surface as a short message. */
export function describeError(error: unknown): { message: string; status: number } {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status: unknown }).status)
      : 500;
  if (status === 404)
    return {
      message:
        "GitHub returned 404: the server token cannot see this repository or workflow (it needs Actions read + write on it).",
      status: 502,
    };
  if (status === 403 || status === 401)
    return {
      message:
        "GitHub rejected the request: the server GITHUB_TOKEN needs Actions read + write permission for this repository.",
      status: 502,
    };
  if (status === 422)
    return { message: "GitHub rejected the inputs for this workflow.", status: 422 };
  const message = error instanceof Error ? error.message : "Request failed";
  if (/not found|expired|too large|Invalid file path/i.test(message)) {
    return { message, status: /expired/i.test(message) ? 410 : 404 };
  }
  console.error("automation error", {
    name: error instanceof Error ? error.name : "unknown",
    status,
  });
  return { message, status: 500 };
}
