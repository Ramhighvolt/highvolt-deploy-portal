export type BookingSiteStatus = "switch_off" | "enabled";

export type BookingSiteCard = {
  id: "hva" | "agent" | "qvm" | "ledgerline" | "edupass";
  domain: string;
  label: string;
  status: BookingSiteStatus;
  note: string;
};

/** Static catalog used when the booking API is not connected. It contains no appointments. */
export const BOOKING_SITE_CARDS: BookingSiteCard[] = [
  {
    id: "hva",
    domain: "highvolt.tech",
    label: "HighVolt",
    status: "switch_off",
    note: "BOOKING_V2_ENABLED_HVA is off. The website keeps the Microsoft Bookings link. Existing Microsoft Bookings appointments are not imported.",
  },
  {
    id: "agent",
    domain: "quantumagent.com.au",
    label: "Quantum Agent",
    status: "switch_off",
    note: "BOOKING_V2_ENABLED_AGENT is off.",
  },
  {
    id: "qvm",
    domain: "quantumvisamanager.com",
    label: "Quantum Visa Manager",
    status: "switch_off",
    note: "BOOKING_V2_ENABLED_QVM is off. Existing v1 Table Storage records stay read-only.",
  },
  {
    id: "ledgerline",
    domain: "quantumledgerline.com",
    label: "Ledgerline",
    status: "switch_off",
    note: "BOOKING_V2_ENABLED_LEDGERLINE is off. /partnership uses this same site id.",
  },
  {
    id: "edupass",
    domain: "quantumedupass.com",
    label: "Quantum EduPass",
    status: "switch_off",
    note: "BOOKING_V2_ENABLED_EDUPASS is off. Portal dispatch maps this domain to HighVolt-Analytics/Quantum-Edupass.",
  },
];

export type SiteRead = {
  id: string;
  ok: boolean;
  bookings?: unknown[];
  error?: string;
  legacyReadError?: string;
};

/** One failed site stays visible as unavailable. The other sites keep their bookings. */
export function combineSiteReads<T extends { id: string }>(cards: T[], reads: SiteRead[]) {
  return cards.map((card) => {
    const read = reads.find((item) => item.id === card.id);
    if (!read || (!read.ok && !(read.bookings || []).length)) {
      return { ...card, bookings: [], readError: read?.error || "unavailable" };
    }
    return { ...card, bookings: read.bookings || [], readError: read.ok ? "" : (read.error || "") };
  });
}

/** Fails closed. A missing or empty viewer list allows nobody, including signed-in portal operators. */
export function bookingViewerAllowed(email: string | null | undefined, viewerList: string | undefined) {
  if (!email) return false;
  const allowed = (viewerList || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export function missingBookingConfig(env: { BOOKINGS_API_BASE?: string; BOOKINGS_PORTAL_API_TOKEN?: string }) {
  const missing: string[] = [];
  if (!env.BOOKINGS_API_BASE) missing.push("BOOKINGS_API_BASE");
  if (!env.BOOKINGS_PORTAL_API_TOKEN) missing.push("BOOKINGS_PORTAL_API_TOKEN");
  return missing;
}
