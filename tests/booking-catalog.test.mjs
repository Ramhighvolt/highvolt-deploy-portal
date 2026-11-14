import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isLegacyBooking, siteAnswerRows } from "../lib/booking-answers.ts";
import { BOOKING_SITE_CARDS, bookingViewerAllowed, combineSiteReads, missingBookingConfig } from "../lib/booking-catalog.ts";

test("booking catalog keeps every site off", () => {
  const hva = BOOKING_SITE_CARDS.find((site) => site.id === "hva");
  assert.equal(hva?.status, "switch_off");
  assert.match(hva?.note || "", /Microsoft Bookings/);
  assert.equal(BOOKING_SITE_CARDS.filter((site) => site.status === "switch_off").length, 5);
  assert.equal(BOOKING_SITE_CARDS.some((site) => "bookings" in site), false);
});

test("portal booking reads use the existing login allowlist", async () => {
  const route = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const detail = await readFile(new URL("../app/api/bookings/detail/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireApiAuth\(\)/);
  assert.match(route, /\/api\/v2\/staff\/bookings/);
  assert.doesNotMatch(route, /BOOKINGS_VIEWER_EMAILS|BOOKING_SQL|database\.windows\.net|Password|mssql/);
  assert.doesNotMatch(detail, /BOOKINGS_VIEWER_EMAILS|BOOKING_SQL|database\.windows\.net/);
  const cards = [
    { id: "hva" },
    { id: "agent" },
    { id: "qvm" },
    { id: "ledgerline" },
    { id: "edupass" },
  ];
  const combined = combineSiteReads(cards, [
    { id: "hva", ok: false, error: "unavailable" },
    { id: "agent", ok: true, bookings: [{ bookingId: "a" }] },
    { id: "qvm", ok: true, bookings: [{ bookingId: "q" }] },
    { id: "ledgerline", ok: true, bookings: [] },
    { id: "edupass", ok: true, bookings: [{ bookingId: "e" }] },
  ]);
  assert.equal(combined.find((site) => site.id === "hva").readError, "unavailable");
  assert.equal(combined.find((site) => site.id === "hva").bookings.length, 0);
  assert.equal(combined.filter((site) => site.readError === "").length, 4);
  assert.equal(combined.find((site) => site.id === "agent").bookings[0].bookingId, "a");
  const legacy = combineSiteReads([{ id: "qvm" }], [{ id: "qvm", ok: false, error: "unavailable", bookings: [{ bookingId: "old", source: "legacy-v1" }] }]);
  assert.equal(legacy[0].readError, "unavailable");
  assert.equal(legacy[0].bookings[0].source, "legacy-v1");
});

test("viewer list fails closed when it is missing or empty", () => {
  assert.equal(bookingViewerAllowed("ada@example.test", ""), false);
  assert.equal(bookingViewerAllowed("ada@example.test", undefined), false);
  assert.equal(bookingViewerAllowed("", "ada@example.test"), false);
  assert.equal(bookingViewerAllowed("ada@example.test", "ada@example.test"), true);
  assert.equal(bookingViewerAllowed("ada@example.test", "other@example.test"), false);
  assert.deepEqual(missingBookingConfig({}), ["BOOKINGS_API_BASE", "BOOKINGS_PORTAL_API_TOKEN"]);
});

test("site answer rows use each form's labels and keep unrecognized fields", () => {
  const qvm = siteAnswerRows("qvm", {
    size: "Sole agent",
    system: "Spreadsheets, email and shared drives",
    bottleneck: "after-hours enquiries",
    first: "Ada",
    last: "Lovelace",
    email: "ada@example.test",
    org: "Practice Co",
    state: "NSW",
    country: "Australia",
    countryCode: "AU",
    consent: true,
    referralSource: "Colleague",
  });
  assert.equal(qvm.find((row) => row.key === "size")?.label, "Practice size");
  assert.equal(qvm.find((row) => row.key === "state")?.label, "State or territory");
  assert.equal(qvm.some((row) => row.key === "countryCode"), false);
  const extra = qvm.find((row) => row.key === "referralSource");
  assert.equal(extra?.recognized, false);
  assert.equal(extra?.value, "Colleague");
  assert.equal(isLegacyBooking("legacy-v1"), true);
  assert.equal(isLegacyBooking("site-form"), false);
});

test("booking routes keep the API token server-side and match the documented staff paths", async () => {
  const route = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const detail = await readFile(new URL("../app/api/bookings/detail/route.ts", import.meta.url), "utf8");
  const legacy = await readFile(new URL("../app/api/bookings/legacy-note/route.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../app/components/BookingsSection.tsx", import.meta.url), "utf8");
  for (const source of [route, detail, legacy]) {
    assert.match(source, /requireApiAuth\(\)/);
    assert.match(source, /BOOKINGS_PORTAL_API_TOKEN/);
    assert.doesNotMatch(source, /NextResponse\.json\([^\)]*BOOKINGS_PORTAL_API_TOKEN/);
  }
  assert.match(route, /\/api\/v2\/staff\/bookings/);
  assert.match(detail, /\/api\/v2\/staff\/bookings\//);
  assert.match(legacy, /\/api\/v2\/staff\/legacy-notes\//);
  assert.match(route, /\/api\/v2\/staff\/microsoft-bookings/);
  assert.match(ui, /Questions and answers/);
  assert.match(ui, /Legacy QVM bookings \(v1\)/);
  assert.match(ui, /New bookings \(v2\)/);
  assert.doesNotMatch(ui, /BOOKINGS_PORTAL_API_TOKEN/);
});
