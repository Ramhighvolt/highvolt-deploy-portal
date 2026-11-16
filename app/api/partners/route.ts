import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/require-api-auth";
import { missingPartnersConfig, sanitizePartnerAccounts } from "@/lib/partners-catalog";

export async function GET() {
  const { response } = await requireApiAuth();
  if (response) return response;

  const base = process.env.LEDGERLINE_PARTNERS_API_BASE ?? "";
  const token = process.env.LEDGERLINE_PARTNERS_ADMIN_TOKEN ?? "";
  const missing = missingPartnersConfig({
    LEDGERLINE_PARTNERS_API_BASE: base,
    LEDGERLINE_PARTNERS_ADMIN_TOKEN: token,
  });

  if (missing.length) {
    return NextResponse.json(
      {
        success: true,
        configured: false,
        missing,
        partners: [],
        count: 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const upstreamUrl = new URL("/api/partners/admin/list", base);
    const res = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as {
      partners?: unknown;
      count?: number;
      error?: string;
      message?: string;
    } | null;

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          missing: [],
          partners: [],
          count: 0,
          error: body?.message || body?.error || "upstream_unavailable",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const partners = sanitizePartnerAccounts(body?.partners);
    return NextResponse.json(
      {
        success: true,
        configured: true,
        missing: [],
        partners,
        count: partners.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        missing: [],
        partners: [],
        count: 0,
        error: "upstream_unavailable",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
