import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  missingPartnersConfig,
  PARTNER_ACCOUNT_FIELDS,
  sanitizePartnerAccounts,
} from "../lib/partners-catalog.ts";

test("partners config fails closed when base or token is missing", () => {
  assert.deepEqual(missingPartnersConfig({}), [
    "LEDGERLINE_PARTNERS_API_BASE",
    "LEDGERLINE_PARTNERS_ADMIN_TOKEN",
  ]);
  assert.deepEqual(
    missingPartnersConfig({ LEDGERLINE_PARTNERS_API_BASE: "https://www.quantumledgerline.com" }),
    ["LEDGERLINE_PARTNERS_ADMIN_TOKEN"],
  );
  assert.deepEqual(
    missingPartnersConfig({
      LEDGERLINE_PARTNERS_API_BASE: "https://www.quantumledgerline.com",
      LEDGERLINE_PARTNERS_ADMIN_TOKEN: "secret",
    }),
    [],
  );
});

test("sanitizePartnerAccounts keeps only safe display fields", () => {
  const partners = sanitizePartnerAccounts([
    {
      name: "Ada",
      email: "ada@example.test",
      firm: "Analytical Engines",
      country: "AU",
      type: "Accounting firm",
      created: "2026-11-16T12:00:00Z",
      password_hash: "should-not-pass",
      id: "P_secret",
      code: "ADA20",
      sessionId: "sess",
    },
    null,
    { email: "   " },
  ]);
  assert.equal(partners.length, 1);
  assert.deepEqual(Object.keys(partners[0]).sort(), [...PARTNER_ACCOUNT_FIELDS].sort());
  assert.equal(partners[0].created, "2026-11-16");
  assert.equal("password_hash" in partners[0], false);
  assert.equal("id" in partners[0], false);
  assert.equal("sessionId" in partners[0], false);
});

test("partners API route reuses portal auth and keeps the admin token server-side", async () => {
  const route = await readFile(new URL("../app/api/partners/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireApiAuth\(\)/);
  assert.match(route, /LEDGERLINE_PARTNERS_ADMIN_TOKEN/);
  assert.match(route, /LEDGERLINE_PARTNERS_API_BASE/);
  assert.match(route, /\/api\/partners\/admin\/list/);
  assert.match(route, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.doesNotMatch(route, /NextResponse\.json\([^)]*LEDGERLINE_PARTNERS_ADMIN_TOKEN/);
  assert.doesNotMatch(route, /password_hash|PARTNER_DB_PATH|\.sqlite/);
});

test("Partners tab sits beside Bookings and stays read-only", async () => {
  const nav = await readFile(new URL("../lib/navigation.ts", import.meta.url), "utf8");
  const sidebar = await readFile(new URL("../app/components/Sidebar.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/components/DashboardClient.tsx", import.meta.url), "utf8");
  const ui = await readFile(new URL("../app/components/PartnersSection.tsx", import.meta.url), "utf8");
  const bookingsUi = await readFile(new URL("../app/components/BookingsSection.tsx", import.meta.url), "utf8");

  assert.match(nav, /"partners"/);
  assert.match(nav, /partners: "Partners"/);
  assert.match(sidebar, /id: "bookings"/);
  assert.match(sidebar, /id: "partners"/);
  assert.match(sidebar, /label: "Partners"/);
  assert.match(dashboard, /activeSection === "bookings" && <BookingsSection \/>/);
  assert.match(dashboard, /activeSection === "partners" && <PartnersSection \/>/);
  assert.match(ui, /fetch\("\/api\/partners"/);
  assert.match(ui, /Work email/);
  assert.match(ui, /Signed up/);
  assert.match(ui, /Passwords and\s+sessions are never shown/);
  assert.doesNotMatch(ui, /password_hash|LEDGERLINE_PARTNERS_ADMIN_TOKEN|PARTNER_ADMIN_TOKEN|\.sqlite/);
  assert.doesNotMatch(ui, /method:\s*"POST"|method:\s*"PUT"|method:\s*"DELETE"/);
  assert.match(bookingsUi, /fetch\(`\/api\/bookings/);
});
