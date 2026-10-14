import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isEmailAllowed } from "@/lib/auth-utils";

export async function operatorAuthFailure() {
  const session = await auth();
  const email = session?.user?.email;
  if (email && isEmailAllowed(email)) return null;
  return NextResponse.json(
    { success: false, error: email ? "Deployment operator access required" : "Authentication required" },
    { status: email ? 403 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
