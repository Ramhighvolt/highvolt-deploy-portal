import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isEmailAllowed } from "@/lib/auth-utils";

export async function requireApiAuth() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email || !isEmailAllowed(email)) {
    return {
      session: null,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { session, response: null };
}
