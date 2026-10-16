import { NextResponse } from "next/server";
import { createGitHubClient } from "@/lib/github-client";
import { requireApiAuth } from "@/lib/require-api-auth";
import { resolveLedgerlineMainRelease } from "@/lib/ledgerline-release";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const release = await resolveLedgerlineMainRelease(createGitHubClient());
    return NextResponse.json({ success: true, release }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to resolve Ledgerline main release", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ success: false, error: "Unable to resolve the current Ledgerline main release" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
