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

function readProfileField(
  profile: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  if (!profile) return null;
  const value = profile[key];
  return normalizeEmail(value);
}

export type MicrosoftEmailFields = {
  userEmail: string | null;
  profileEmail: string | null;
  preferredUsername: string | null;
  upn: string | null;
  uniqueName: string | null;
  mail: string | null;
  selectedEmail: string | null;
};

export function extractMicrosoftEmailFields(
  user: { email?: string | null },
  profile?: Record<string, unknown> | null
): MicrosoftEmailFields {
  const userEmail = normalizeEmail(user.email ?? null);
  const profileEmail = readProfileField(profile, "email");
  const preferredUsername = readProfileField(profile, "preferred_username");
  const upn = readProfileField(profile, "upn");
  const uniqueName = readProfileField(profile, "unique_name");
  const mail = readProfileField(profile, "mail");

  const selectedEmail =
    userEmail ??
    profileEmail ??
    preferredUsername ??
    upn ??
    uniqueName ??
    mail ??
    null;

  return {
    userEmail,
    profileEmail,
    preferredUsername,
    upn,
    uniqueName,
    mail,
    selectedEmail,
  };
}

export function resolveMicrosoftLoginEmail(
  user: { email?: string | null },
  profile?: Record<string, unknown> | null
): string | null {
  return extractMicrosoftEmailFields(user, profile).selectedEmail;
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email ?? null);
  if (!normalized) return false;
  return getAllowedEmails().includes(normalized);
}

export function toProfileRecord(
  profile: unknown
): Record<string, unknown> | null {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }
  return profile as Record<string, unknown>;
}
