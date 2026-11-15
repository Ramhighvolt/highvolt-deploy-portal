/** Secondary text on a month-calendar booking chip. Always the site label, never the attendee name. */
export function calendarTileSiteText(siteLabel: string | undefined): string {
  return String(siteLabel || "").trim() || "Unknown site";
}

/** Tooltip for a month-calendar booking chip. Site first; attendee name only when present. */
export function calendarTileTooltip(siteLabel: string | undefined, attendeeName?: string): string {
  const site = calendarTileSiteText(siteLabel);
  const name = String(attendeeName || "").trim();
  return name ? `${site} · ${name}` : site;
}
