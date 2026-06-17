"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithMicrosoft(callbackUrl?: string) {
  await signIn("microsoft-entra-id", {
    redirectTo: callbackUrl || "/",
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
