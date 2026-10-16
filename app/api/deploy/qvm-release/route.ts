import { NextResponse } from "next/server";
import { createGitHubClient } from "@/lib/github-client";
import { requireApiAuth } from "@/lib/require-api-auth";
import { resolveQvmMainRelease } from "@/lib/qvm-release";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const release = await resolveQvmMainRelease(createGitHubClient());
    return NextResponse.json({ success: true, release }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to resolve Quantum Visa Manager main release", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ success: false, error: "Unable to resolve the current Quantum Visa Manager main release" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
