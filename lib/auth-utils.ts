export function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  return normalized;
}

export function resolveMicrosoftLoginEmail(
  user: { email?: string | null },
  profile?: Record<string, unknown> | null
): string | null {
  const candidates: unknown[] = [
    user.email,
    profile?.email,
    profile?.preferred_username,
    profile?.upn,
    profile?.unique_name,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email ?? null);
  if (!normalized) return false;
  return getAllowedEmails().includes(normalized);
}
