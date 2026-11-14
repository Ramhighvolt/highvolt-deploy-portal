export type BookingAnswers = Record<string, unknown>;

export type AnswerRow = {
  key: string;
  label: string;
  value: string;
  recognized: boolean;
};

type FieldDef = { key: string; label: string };

/** Question order and labels as each website form collects them. */
const SITE_FIELDS: Record<string, FieldDef[]> = {
  hva: [
    { key: "size", label: "Organisation size" },
    { key: "system", label: "What do you use today?" },
    { key: "bottleneck", label: "Biggest bottleneck" },
    { key: "first", label: "First name" },
    { key: "last", label: "Last name" },
    { key: "email", label: "Work email" },
    { key: "phone", label: "Phone" },
    { key: "org", label: "Organisation" },
    { key: "country", label: "Country" },
    { key: "consent", label: "Contact consent" },
  ],
  agent: [
    { key: "size", label: "Business size" },
    { key: "system", label: "How do you handle enquiries today?" },
    { key: "systemName", label: "System name / details" },
    { key: "bottleneck", label: "Biggest bottleneck" },
    { key: "first", label: "First name" },
    { key: "last", label: "Last name" },
    { key: "email", label: "Work email" },
    { key: "phone", label: "Phone" },
    { key: "org", label: "Business or company" },
    { key: "country", label: "Country" },
    { key: "partner", label: "Agency or implementation partner" },
    { key: "consent", label: "Contact consent" },
  ],
  qvm: [
    { key: "size", label: "Practice size" },
    { key: "system", label: "Current system" },
    { key: "systemName", label: "System name" },
    { key: "bottleneck", label: "Biggest bottleneck" },
    { key: "first", label: "First name" },
    { key: "last", label: "Last name" },
    { key: "email", label: "Work email" },
    { key: "phone", label: "Phone" },
    { key: "org", label: "Practice or company" },
    { key: "state", label: "State or territory" },
    { key: "country", label: "Country" },
    { key: "consent", label: "Contact consent" },
  ],
  ledgerline: [
    { key: "size", label: "Business or practice size" },
    { key: "system", label: "What accounting or ERP software do you use?" },
    { key: "systemName", label: "System name / details" },
    { key: "bottleneck", label: "Biggest bottleneck" },
    { key: "first", label: "First name" },
    { key: "last", label: "Last name" },
    { key: "email", label: "Work email" },
    { key: "phone", label: "Phone" },
    { key: "org", label: "Business or accounting firm" },
    { key: "country", label: "Country" },
    { key: "partner", label: "Accounting, audit or vCFO firm" },
    { key: "consent", label: "Contact consent" },
  ],
  edupass: [
    { key: "size", label: "Consultancy size" },
    { key: "system", label: "What do you use to manage students today?" },
    { key: "systemName", label: "System name / details" },
    { key: "bottleneck", label: "Biggest bottleneck" },
    { key: "first", label: "First name" },
    { key: "last", label: "Last name" },
    { key: "email", label: "Work email" },
    { key: "phone", label: "Phone" },
    { key: "org", label: "Consultancy or organisation" },
    { key: "country", label: "Country" },
    { key: "partner", label: "Education group or institutional partner" },
    { key: "consent", label: "Contact consent" },
  ],
};

function formatAnswerValue(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => formatAnswerValue(item))
      .filter(Boolean)
      .join(", ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (ch) => ch.toUpperCase());
}

export function parseBookingAnswers(input: unknown): BookingAnswers {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as BookingAnswers;
  }
  if (typeof input === "string" && input.trim()) {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as BookingAnswers;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Builds Q&A rows for a site using that form's labels and order.
 * Only includes fields that were actually returned. Extra keys stay visible as unrecognized.
 */
export function siteAnswerRows(site: string | undefined, answersInput: unknown): AnswerRow[] {
  const answers = parseBookingAnswers(answersInput);
  const fields = SITE_FIELDS[site || ""] || [];
  const used = new Set<string>();
  const rows: AnswerRow[] = [];

  for (const field of fields) {
    if (!(field.key in answers)) continue;
    const value = formatAnswerValue(answers[field.key]);
    if (!value) continue;
    used.add(field.key);
    rows.push({ key: field.key, label: field.label, value, recognized: true });
  }

  // countryCode is derived from country; skip when country already shown.
  if (used.has("country")) used.add("countryCode");

  for (const key of Object.keys(answers).sort()) {
    if (used.has(key)) continue;
    const value = formatAnswerValue(answers[key]);
    if (!value) continue;
    rows.push({ key, label: humanizeKey(key), value, recognized: false });
  }

  return rows;
}

export function isLegacyBooking(source: string | undefined): boolean {
  return source === "legacy-v1";
}
