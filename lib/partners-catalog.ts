export type PartnerAccount = {
  name: string;
  email: string;
  firm: string;
  country: string;
  type: string;
  created: string;
};

export const PARTNER_ACCOUNT_FIELDS = [
  "name",
  "email",
  "firm",
  "country",
  "type",
  "created",
] as const;

export function missingPartnersConfig(env: {
  LEDGERLINE_PARTNERS_API_BASE?: string;
  LEDGERLINE_PARTNERS_ADMIN_TOKEN?: string;
} = process.env): string[] {
  return [
    !env.LEDGERLINE_PARTNERS_API_BASE ? "LEDGERLINE_PARTNERS_API_BASE" : "",
    !env.LEDGERLINE_PARTNERS_ADMIN_TOKEN ? "LEDGERLINE_PARTNERS_ADMIN_TOKEN" : "",
  ].filter(Boolean);
}

export function sanitizePartnerAccounts(raw: unknown): PartnerAccount[] {
  if (!Array.isArray(raw)) return [];
  const partners: PartnerAccount[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name || "").trim();
    const email = String(row.email || "").trim();
    const firm = String(row.firm || "").trim();
    if (!name && !email && !firm) continue;
    partners.push({
      name,
      email,
      firm,
      country: String(row.country || "").trim(),
      type: String(row.type || "").trim(),
      created: String(row.created || "").trim().slice(0, 10),
    });
  }
  return partners;
}
