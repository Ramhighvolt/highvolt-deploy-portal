import assert from "node:assert/strict";
import test from "node:test";
import { consoleEnabled, loadConsoleConfig } from "../lib/console/config.ts";
import { canWrite, decodeClaims, isOperatorRole, needsRefresh } from "../lib/console/jwt.ts";
import { callService, publicStatus } from "../lib/console/service-client.ts";
import { confirmEnroll, passwordLogin, refreshTokens, startEnroll, verifyMfa } from "../lib/console/auth-flow.ts";
import { getClient, listClients, setModule } from "../lib/console/clients.ts";

const ENV = { CONSOLE_LOGIN_URL: "https://login.example.test", CONSOLE_COMMERCE_URL: "https://commerce.example.test" };
const CFG = loadConsoleConfig(ENV);

/** A fake fetch: routes by "METHOD path-prefix", records every call. */
function fake(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ method, url: u.origin + u.pathname, search: u.search, headers: init.headers ?? {}, body: init.body });
    for (const [key, make] of Object.entries(routes)) {
      const [m, prefix] = key.split(" ");
      if (m === method && (u.origin + u.pathname).startsWith(prefix)) {
        const r = typeof make === "function" ? make(u, init) : make;
        if (r === "throw") throw new Error("network down");
        return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
          status: r.status ?? 200,
          headers: r.etag ? { etag: r.etag } : {},
        });
      }
    }
    return new Response("{}", { status: 404 });
  };
  return { f, calls };
}

const jwt = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

test("the Console is off unless switched on and refuses an unsafe or incomplete configuration", () => {
  assert.equal(consoleEnabled({}), false);
  assert.equal(consoleEnabled({ CONSOLE_ENABLED: "yes" }), false);
  assert.equal(consoleEnabled({ CONSOLE_ENABLED: "true" }), true);
  assert.throws(() => loadConsoleConfig({}), /CONSOLE_LOGIN_URL is required/);
  assert.throws(() => loadConsoleConfig({ ...ENV, CONSOLE_COMMERCE_URL: "http://commerce.example.test" }), /https/);
  assert.throws(() => loadConsoleConfig({ ...ENV, CONSOLE_LOGIN_URL: "not a url" }), /valid URL/);
  assert.throws(() => loadConsoleConfig({ ...ENV, CONSOLE_APP_ID: "Bad App!" }), /app id/);
  const local = loadConsoleConfig({ CONSOLE_LOGIN_URL: "http://localhost:8080/", CONSOLE_COMMERCE_URL: "http://127.0.0.1:8082" });
  assert.equal(local.loginUrl, "http://localhost:8080");
  assert.equal(CFG.appId, "quantum-quber");
  assert.equal(CFG.platformAppId, "platform");
});

test("claims are decoded for display only; bad tokens read as nothing; roles split into writers and readers", () => {
  const good = jwt({ sub: "u1", role: "platform_admin", exp: 2000 });
  assert.deepEqual(decodeClaims(good), { sub: "u1", role: "platform_admin", exp: 2000 });
  for (const bad of [undefined, null, "", "a.b", "a.!!!.c", jwt({ sub: 1, role: "x", exp: 1 }), jwt({ sub: "u", role: "x" })]) {
    assert.equal(decodeClaims(bad), null);
  }
  assert.equal(canWrite("platform_owner"), true);
  assert.equal(canWrite("platform_admin"), true);
  for (const r of ["support", "auditor", "billing", "user", "admin", "super_admin"]) assert.equal(canWrite(r), false);
  assert.equal(isOperatorRole("auditor"), true);
  assert.equal(isOperatorRole("admin"), false);
  assert.equal(needsRefresh(null, 100), true);
  assert.equal(needsRefresh({ sub: "u", role: "r", exp: 1000 }, 900), false);
  assert.equal(needsRefresh({ sub: "u", role: "r", exp: 1000 }, 980), true);
});

test("a service call sends the bearer, survives a dead network and a non-JSON answer, and public errors never echo upstream text", async () => {
  const { f, calls } = fake({
    "GET https://a.test/ok": { body: { hello: 1 }, etag: '"3"' },
    "GET https://a.test/html": () => new Response("<html>boom</html>", { status: 502 }),
    "GET https://a.test/down": "throw",
  });
  const ok = await callService(f, "https://a.test", "/ok", { token: "tok" });
  assert.deepEqual(ok, { status: 200, body: { hello: 1 }, etag: '"3"' });
  assert.equal(calls[0].headers.authorization, "Bearer tok");
  assert.deepEqual(await callService(f, "https://a.test", "/down"), { status: 0, body: null, etag: null });
  assert.equal((await callService(f, "https://a.test", "/missing")).status, 404);
  assert.equal(publicStatus(401).status, 401);
  assert.equal(publicStatus(412).status, 409);
  assert.equal(publicStatus(428).status, 409);
  assert.equal(publicStatus(422).status, 422);
  assert.equal(publicStatus(418).status, 400);
  assert.equal(publicStatus(0).status, 502);
  assert.equal(publicStatus(503).status, 502);
  for (const s of [401, 403, 404, 409, 422, 502]) assert.doesNotMatch(publicStatus(s).message, /boom|stack|sql/i);
});

test("the password step returns a challenge, never tokens, and anything else is a uniform failure", async () => {
  const challenge = { body: { mfa_token: "chal-1", mfa_step: "verify", mfa_methods: ["totp", "recovery_code"] } };
  const { f, calls } = fake({ "POST https://login.example.test/login": challenge });
  const r = await passwordLogin(f, CFG, " op@ops.test ", "pw");
  assert.deepEqual(r, { ok: true, challenge: { step: "verify", token: "chal-1", methods: ["totp", "recovery_code"] } });
  assert.deepEqual(JSON.parse(calls[0].body), { email: "op@ops.test", password: "pw", app_id: "platform" });

  const tokens = fake({ "POST https://login.example.test/login": { body: { access_token: "a", refresh_token: "r" } } });
  assert.deepEqual(await passwordLogin(tokens.f, CFG, "op@ops.test", "pw"), { ok: false, status: 502 });
  for (const [upstream, expected] of [[401, 401], [403, 401], [429, 401], [500, 502]]) {
    const x = fake({ "POST https://login.example.test/login": { status: upstream, body: { detail: "secret detail" } } });
    assert.deepEqual(await passwordLogin(x.f, CFG, "op@ops.test", "pw"), { ok: false, status: expected });
  }
  const down = fake({ "POST https://login.example.test/login": "throw" });
  assert.deepEqual(await passwordLogin(down.f, CFG, "op@ops.test", "pw"), { ok: false, status: 502 });
});

test("bad credentials input is refused before any upstream call", async () => {
  const { f, calls } = fake({});
  for (const [e, p] of [["", "pw"], ["nope", "pw"], ["a@b.c", ""], ["a@b.c", "x".repeat(1025)], [undefined, "pw"], ["a@b.c", 5]]) {
    assert.deepEqual(await passwordLogin(f, CFG, e, p), { ok: false, status: 400 });
  }
  assert.deepEqual(await verifyMfa(f, CFG, { token: "t", code: "12345" }), { ok: false, status: 400 });
  assert.deepEqual(await verifyMfa(f, CFG, { token: "t", code: "12345a" }), { ok: false, status: 400 });
  assert.deepEqual(await verifyMfa(f, CFG, { token: "", code: "123456" }), { ok: false, status: 400 });
  assert.deepEqual(await verifyMfa(f, CFG, { token: "t" }), { ok: false, status: 400 });
  assert.deepEqual(await verifyMfa(f, CFG, { token: "t", recoveryCode: "x".repeat(41) }), { ok: false, status: 400 });
  assert.deepEqual(await startEnroll(f, CFG, ""), { ok: false, status: 400 });
  assert.deepEqual(await confirmEnroll(f, CFG, { token: "t", code: "abc" }), { ok: false, status: 400 });
  assert.equal(calls.length, 0);
});

test("the second step sends a code or a recovery code and returns tokens only on success", async () => {
  const ok = { body: { access_token: "acc", refresh_token: "ref" } };
  const a = fake({ "POST https://login.example.test/login/mfa": ok });
  assert.deepEqual(await verifyMfa(a.f, CFG, { token: "t", code: "123456" }), { ok: true, accessToken: "acc", refreshToken: "ref" });
  assert.deepEqual(JSON.parse(a.calls[0].body), { mfa_token: "t", code: "123456" });
  const b = fake({ "POST https://login.example.test/login/mfa": ok });
  await verifyMfa(b.f, CFG, { token: "t", recoveryCode: "ABCD-EFGH-2345-67AB" });
  assert.deepEqual(JSON.parse(b.calls[0].body), { mfa_token: "t", recovery_code: "ABCD-EFGH-2345-67AB" });
  const bad = fake({ "POST https://login.example.test/login/mfa": { status: 401, body: {} } });
  assert.deepEqual(await verifyMfa(bad.f, CFG, { token: "t", code: "123456" }), { ok: false, status: 401 });
  const half = fake({ "POST https://login.example.test/login/mfa": { body: { access_token: "only" } } });
  assert.deepEqual(await verifyMfa(half.f, CFG, { token: "t", code: "123456" }), { ok: false, status: 401 });
});

test("enrolment returns the secret once and the recovery codes with the tokens", async () => {
  const e = fake({ "POST https://login.example.test/login/mfa/enroll/confirm": { body: { access_token: "a", refresh_token: "r", recovery_codes: ["AAAA-BBBB-CCCC-DDDD", 5] } },
    "POST https://login.example.test/login/mfa/enroll": { body: { secret: "S3CRET", otpauth_uri: "otpauth://totp/x" } } });
  assert.deepEqual(await startEnroll(e.f, CFG, "t"), { ok: true, secret: "S3CRET", otpauthUri: "otpauth://totp/x" });
  assert.deepEqual(await confirmEnroll(e.f, CFG, { token: "t", code: "123456" }),
    { ok: true, accessToken: "a", refreshToken: "r", recoveryCodes: ["AAAA-BBBB-CCCC-DDDD"] });
  const rf = fake({ "POST https://login.example.test/refresh": { body: { access_token: "a2", refresh_token: "r2" } } });
  assert.deepEqual(await refreshTokens(rf.f, CFG, "r"), { ok: true, accessToken: "a2", refreshToken: "r2" });
  assert.deepEqual(JSON.parse(rf.calls[0].body), { refresh_token: "r" });
});

const DIRECTORY = {
  body: {
    data: [
      { org_id: "acme-aaa", display_name: "Acme", status: "active", apps: ["quantum-quber"], member_count: 4, created_at: "2026-11-01T00:00:00Z" },
      { org_id: "Legacy_ID", display_name: "Legacy", status: "active", apps: ["quantum-quber"], member_count: 1 },
      { org_id: "beta-bbb", display_name: "Beta", status: "suspended", apps: [], member_count: 0 },
    ],
    page: { next_cursor: "CURSOR2", limit: 25 },
  },
};
const ENTITLEMENTS = {
  body: { data: [{ customer_id: "acme-aaa", plan_code: "edupass_trial", status: "active", features: ["M1", "M2"], version: 7 }] },
};

test("the clients list joins the directory with the entitlements of exactly that page, as the operator", async () => {
  const { f, calls } = fake({
    "GET https://login.example.test/restricted/v1/platform/orgs": DIRECTORY,
    "GET https://commerce.example.test/restricted/v1/apps/quantum-quber/entitlements": ENTITLEMENTS,
  });
  const r = await listClients(f, CFG, "op-token", { q: " acme ", status: "active", cursor: "C1", limit: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.nextCursor, "CURSOR2");
  assert.equal(r.entitlementsAvailable, true);
  assert.deepEqual(r.rows.map((x) => x.orgId), ["acme-aaa", "Legacy_ID", "beta-bbb"]);
  assert.deepEqual(r.rows[0].modules, ["M1", "M2"]);
  assert.equal(r.rows[0].entitlementVersion, 7);
  assert.equal(r.rows[0].memberCount, 4);
  assert.equal(r.rows[1].modules, null); // no entitlement found: unknown, not "no modules"
  assert.equal(r.rows[2].planCode, null);
  const q = new URLSearchParams(calls[0].search);
  assert.equal(q.get("app_id"), "quantum-quber");
  assert.equal(q.get("q"), "acme");
  assert.equal(q.get("status"), "active");
  assert.equal(q.get("cursor"), "C1");
  assert.equal(q.get("limit"), "10");
  assert.equal(calls[0].headers.authorization, "Bearer op-token");
  assert.equal(calls[1].headers.authorization, "Bearer op-token");
  // only well-formed ids are sent to the entitlement service
  assert.equal(new URLSearchParams(calls[1].search).get("customer_ids"), "acme-aaa,beta-bbb");
});

test("an unreachable entitlement service degrades the list instead of failing it; a directory failure fails it with its status", async () => {
  const half = fake({
    "GET https://login.example.test/restricted/v1/platform/orgs": DIRECTORY,
    "GET https://commerce.example.test/restricted/v1/apps/": { status: 503 },
  });
  const r = await listClients(half.f, CFG, "t", {});
  assert.equal(r.ok, true);
  assert.equal(r.entitlementsAvailable, false);
  assert.equal(r.rows.length, 3);
  const denied = fake({ "GET https://login.example.test/restricted/v1/platform/orgs": { status: 403 } });
  assert.deepEqual(await listClients(denied.f, CFG, "t", {}), { ok: false, upstream: 403 });
  assert.equal(denied.calls.length, 1);
  const empty = fake({ "GET https://login.example.test/restricted/v1/platform/orgs": { body: { data: [], page: {} } } });
  const none = await listClients(empty.f, CFG, "t", {});
  assert.deepEqual([none.ok, none.rows, none.nextCursor], [true, [], null]);
  assert.equal(empty.calls.length, 1); // nothing to look up
});

test("list inputs are validated and clamped", async () => {
  const { f, calls } = fake({ "GET https://login.example.test/restricted/v1/platform/orgs": { body: { data: [] } } });
  assert.deepEqual(await listClients(f, CFG, "t", { status: "gone" }), { ok: false, upstream: 400 });
  await listClients(f, CFG, "t", { limit: 9999 });
  await listClients(f, CFG, "t", { limit: -4 });
  assert.equal(new URLSearchParams(calls[0].search).get("limit"), "100");
  assert.equal(new URLSearchParams(calls[1].search).get("limit"), "1");
  await listClients(f, CFG, "t", { q: "x".repeat(500) });
  assert.equal(new URLSearchParams(calls[2].search).get("q").length, 100);
});

test("a client detail combines the directory record and the entitlement with its version", async () => {
  const { f } = fake({
    "GET https://login.example.test/restricted/v1/platform/orgs/acme-aaa": { body: { org_id: "acme-aaa", display_name: "Acme", status: "active", apps: ["quantum-quber"], member_count: 4 } },
    "GET https://commerce.example.test/restricted/v1/customers/acme-aaa/apps/quantum-quber/entitlement": { body: { plan_code: "p", status: "active", features: ["M1"], version: 3 }, etag: '"3"' },
  });
  const d = await getClient(f, CFG, "t", "acme-aaa");
  assert.equal(d.ok, true);
  assert.equal(d.etag, '"3"');
  assert.deepEqual(d.client.modules, ["M1"]);
  assert.deepEqual(await getClient(f, CFG, "t", "Not Valid!"), { ok: false, upstream: 404 });
  const none = fake({
    "GET https://login.example.test/restricted/v1/platform/orgs/new-org": { body: { org_id: "new-org", display_name: "New" } },
    "GET https://commerce.example.test/": { status: 404 },
  });
  const n = await getClient(none.f, CFG, "t", "new-org");
  assert.equal(n.ok, true);
  assert.equal(n.client.modules, null);
  assert.equal(n.entitlementsAvailable, true);
});

test("a module switch is validated, sends If-Match and the reason, and reports whether anything changed", async () => {
  const put = fake({ "PUT https://commerce.example.test/restricted/v1/customers/acme-aaa/apps/quantum-quber/entitlement/modules/M3": { body: { changed: true, version: 8 } } });
  const ok = await setModule(put.f, CFG, "op-token", { orgId: "acme-aaa", module: "M3", state: "disabled", reason: "  customer asked us to pause M3 ", version: 7 });
  assert.deepEqual(ok, { ok: true, changed: true, version: 8 });
  assert.equal(put.calls[0].headers["if-match"], '"7"');
  assert.deepEqual(JSON.parse(put.calls[0].body), { state: "disabled", reason: "customer asked us to pause M3" });
  assert.equal(put.calls[0].headers.authorization, "Bearer op-token");

  const none = fake({});
  const base = { orgId: "acme-aaa", module: "M3", state: "enabled", reason: "a valid reason", version: 1 };
  for (const bad of [{ orgId: "ACME" }, { module: "M3;drop" }, { module: "" }, { state: "maybe" }, { reason: "no" }, { reason: "x".repeat(501) },
    { version: "7" }, { version: -1 }, { version: 1.5 }, { version: null }]) {
    assert.deepEqual(await setModule(none.f, CFG, "t", { ...base, ...bad }), { ok: false, upstream: 400 });
  }
  assert.equal(none.calls.length, 0);
  for (const upstream of [412, 428, 422, 404, 403]) {
    const x = fake({ "PUT https://commerce.example.test/": { status: upstream, body: { detail: "internal text" } } });
    assert.deepEqual(await setModule(x.f, CFG, "t", base), { ok: false, upstream });
  }
});
