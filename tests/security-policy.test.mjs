import assert from "node:assert/strict";
import test from "node:test";
import { websites } from "../lib/websites.ts";
import {
  authorizeLogin,
  isSameOriginRequest,
  productionDispatchError,
  validateDispatchBody,
} from "../lib/security-policy.js";

test("missing and non-operator identities are rejected separately", () => {
  assert.deepEqual(authorizeLogin(null, "ram,ops"), { status: 401, role: null });
  assert.deepEqual(authorizeLogin("outsider", "ram,ops"), { status: 403, role: null });
  assert.deepEqual(authorizeLogin("Ops", "ram,ops"), { status: 200, role: "operator" });
});

test("allowlist is normalized without accepting partial usernames", () => {
  assert.equal(authorizeLogin("ram", " @Ram , ops ").status, 200);
  assert.equal(authorizeLogin("ram-admin", "ram").status, 403);
  assert.equal(authorizeLogin("ram", "").status, 403);
});

test("dispatch only accepts a known project id and rejects caller-supplied routing", () => {
  assert.equal(validateDispatchBody({ websiteId: "unknown" }, websites).ok, false);
  assert.equal(validateDispatchBody({ websiteId: "hva", repo: "attacker/repo" }, websites).ok, false);
  assert.equal(validateDispatchBody({ websiteId: "hva", workflow: "attacker.yml" }, websites).ok, false);
  assert.equal(validateDispatchBody({ websiteId: "hva", workflowFile: "attacker.yml" }, websites).ok, false);
  const result = validateDispatchBody({ websiteId: "quantum-ledgerline" }, websites);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.website.repo, "Ledgerline");
    assert.equal(result.website.workflowFile, "deploy.yml");
    assert.equal(result.website.branch, "main");
    assert.equal(result.website.deploymentEnabled, undefined);
  }
});

test("all pre-existing HighVolt project mappings remain present", () => {
  assert.deepEqual(websites.map((site) => site.id), [
    "hva",
    "quantum-agent",
    "quantum-edupass",
    "quantum-ledgerline",
  ]);
  for (const website of websites.slice(0, 3)) {
    assert.equal(website.deploymentEnabled, undefined);
    assert.equal(website.owner, "HighVolt-Analytics");
  }
});

test("JSON body types and unexpected fields are rejected", () => {
  assert.equal(validateDispatchBody([], websites).ok, false);
  assert.equal(validateDispatchBody({ websiteId: "hva", releaseCommit: 1 }, websites).ok, false);
  assert.equal(validateDispatchBody({ websiteId: "hva", environment: "production" }, websites).ok, false);
});

test("mutating requests require a same-origin browser request", () => {
  assert.equal(isSameOriginRequest("https://portal.example/api/deploy", "https://portal.example", "same-origin"), true);
  assert.equal(isSameOriginRequest("https://portal.example/api/deploy", "https://attacker.example", "same-site"), false);
  assert.equal(isSameOriginRequest("https://portal.example/api/deploy", null, "same-origin"), false);
  assert.equal(isSameOriginRequest("https://portal.example/api/deploy", "https://portal.example", "cross-site"), false);
});

test("Ledgerline remains paused until both the server gate and release confirmation are satisfied", () => {
  const ledgerline = websites.find((site) => site.id === "quantum-ledgerline");
  const validCommit = "a".repeat(40);
  assert.equal(productionDispatchError(ledgerline, "false", validCommit, "DEPLOY")?.status, 423);
  assert.equal(productionDispatchError(ledgerline, "true", "short", "DEPLOY")?.status, 400);
  assert.equal(productionDispatchError(ledgerline, "true", validCommit, "DEPLOY"), null);
});
