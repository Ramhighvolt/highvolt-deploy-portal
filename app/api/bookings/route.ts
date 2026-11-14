import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/require-api-auth";
import { BOOKING_SITE_CARDS, combineSiteReads, type SiteRead } from "@/lib/booking-catalog";

type UpstreamSite = {
  id?: string;
  bookings?: unknown[];
  readError?: string;
  legacyReadError?: string;
  status?: string;
  domain?: string;
};

type StaffBookingsUpstream = {
  sites?: UpstreamSite[];
  missing?: string[];
  legacyMissing?: string[];
  legacyReadError?: string;
  legacyUnavailable?: boolean;
  status?: string;
};

async function readCombined(
  base: string,
  token: string,
  params: URLSearchParams,
): Promise<{ reads: SiteRead[] | null; upstream: StaffBookingsUpstream | null }> {
  try {
    const upstreamUrl = new URL("/api/v2/staff/bookings", base);
    for (const key of ["date", "assignee", "site"]) {
      const value = params.get(key);
      if (value) upstreamUrl.searchParams.set(key, value);
    }
    const res = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as StaffBookingsUpstream | null;
    if (!res.ok || !Array.isArray(body?.sites)) return { reads: null, upstream: body };
    const reads = body.sites.map((site) => ({
      id: site.id || "",
      ok: !site.readError,
      error: site.readError || "",
      bookings: site.bookings || [],
      legacyReadError: site.legacyReadError || "",
    }));
    return { reads, upstream: body };
  } catch {
    return { reads: null, upstream: null };
  }
}

export async function GET(request: Request) {
  const { response } = await requireApiAuth();
  if (response) return response;

  const base = process.env.BOOKINGS_API_BASE ?? "";
  const token = process.env.BOOKINGS_PORTAL_API_TOKEN ?? "";
  const missing = [!base ? "BOOKINGS_API_BASE" : "", !token ? "BOOKINGS_PORTAL_API_TOKEN" : ""].filter(Boolean);
  const url = new URL(request.url);
  const requestedSite = url.searchParams.get("site") || "";
  if (missing.length) {
    return NextResponse.json({
      success: true,
      configured: false,
      missing,
      legacyMissing: [],
      legacyReadError: "",
      sites: combineSiteReads(BOOKING_SITE_CARDS, []),
      microsoftBookings: { readOnly: true, configured: false, appointments: [] },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const { reads, upstream } = await readCombined(base, token, url.searchParams);
  const padded = BOOKING_SITE_CARDS.map((card) => {
    if (requestedSite && card.id !== requestedSite) {
      return { id: card.id, ok: true, bookings: [], legacyReadError: "" };
    }
    const read = reads?.find((item) => item.id === card.id);
    if (!reads || !read) return { id: card.id, ok: false, error: "unavailable", bookings: [], legacyReadError: "" };
    return read;
  });

  const combined = combineSiteReads(BOOKING_SITE_CARDS, padded).map((site) => {
    const read = padded.find((item) => item.id === site.id);
    return {
      ...site,
      legacyReadError: (read as { legacyReadError?: string } | undefined)?.legacyReadError || "",
    };
  });

  let microsoftBookings = { readOnly: true, configured: false, appointments: [] as unknown[], error: "" };
  try {
    const msUrl = new URL("/api/v2/staff/microsoft-bookings", base);
    const res = await fetch(msUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) microsoftBookings = { readOnly: true, configured: false, appointments: [], error: "unavailable" };
    else microsoftBookings = { readOnly: true, configured: Boolean(body.configured), appointments: body.appointments || [], error: body.error || "" };
  } catch {
    microsoftBookings = { readOnly: true, configured: false, appointments: [], error: "unavailable" };
  }

  return NextResponse.json({
    success: true,
    configured: true,
    missing: upstream?.missing || [],
    legacyMissing: upstream?.legacyMissing || [],
    legacyReadError: upstream?.legacyReadError || "",
    sites: combined,
    upstream,
    microsoftBookings,
  }, { headers: { "Cache-Control": "no-store" } });
}
