export type OperatorClaims = { sub: string; role: string; exp: number };

/** Roles that may change things in the Console; everything else is read only. */
const WRITER_ROLES = new Set(["platform_owner", "platform_admin"]);
const OPERATOR_ROLES = new Set(["platform_owner", "platform_admin", "billing", "support", "auditor"]);

/**
 * Reads the claims of an access token to decide what to show and when to refresh. This is NOT verification: every
 * service the Console calls verifies the token itself, so a forged cookie gains nothing.
 */
export function decodeClaims(token: string | undefined | null): OperatorClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload.sub !== "string" || typeof payload.role !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return { sub: payload.sub, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

export function isOperatorRole(role: string): boolean {
  return OPERATOR_ROLES.has(role);
}

export function canWrite(role: string): boolean {
  return WRITER_ROLES.has(role);
}

/** True when the token is missing, unreadable, or expires within {@code skewSeconds}. */
export function needsRefresh(claims: OperatorClaims | null, nowSeconds: number, skewSeconds = 30): boolean {
  return !claims || claims.exp - skewSeconds <= nowSeconds;
}
