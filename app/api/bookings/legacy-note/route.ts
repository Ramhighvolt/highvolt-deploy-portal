import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/require-api-auth";
export async function GET(request: Request) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const base = process.env.BOOKINGS_API_BASE ?? "";
  const token = process.env.BOOKINGS_PORTAL_API_TOKEN ?? "";
  const missing = [!base ? "BOOKINGS_API_BASE" : "", !token ? "BOOKINGS_PORTAL_API_TOKEN" : ""].filter(Boolean);
  if (missing.length) {
    return NextResponse.json({ success: false, configured: false, missing, status: "unconfigured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const bookingId = new URL(request.url).searchParams.get("bookingId") || "";
  const upstream = new URL(`/api/v2/staff/legacy-notes/${encodeURIComponent(bookingId)}`, base);
  const res = await fetch(upstream, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  return NextResponse.json({ success: res.ok, upstream: body }, { status: res.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
