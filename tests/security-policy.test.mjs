import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { websites } from "../lib/websites.ts";
import {
  authorizeLogin,
  isSameOriginRequest,
  productionDispatchError,
  validateDispatchBody,
} from "../lib/security-policy.js";
import { classifyDeploymentJobs } from "../lib/deployment-history.ts";
import { hasActiveMainDeployment, resolveLedgerlineMainRelease, validateLedgerlineReleaseConfirmation } from "../lib/ledgerline-release.ts";
import { hasActiveQvmMainDeployment, resolveQvmMainRelease, validateQvmReleaseConfirmation } from "../lib/qvm-release.ts";

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

test("all HighVolt project mappings remain present including Quantum Visa Manager", () => {
  assert.deepEqual(websites.map((site) => site.id), [
    "hva",
    "quantum-agent",
    "quantum-edupass",
    "quantum-ledgerline",
    "quantum-visa-manager",
  ]);
  for (const website of websites.slice(0, 3)) {
    assert.equal(website.deploymentEnabled, undefined);
    assert.equal(website.owner, "HighVolt-Analytics");
  }
  const qvm = websites.find((site) => site.id === "quantum-visa-manager");
  assert.equal(qvm?.repo, "Quantum-Visa-Manager");
  assert.equal(qvm?.owner, "HighVolt-Analytics");
  assert.equal(qvm?.workflowFile, "deploy.yml");
  assert.equal(qvm?.branch, "main");
  assert.equal(qvm?.domain, "quantumvisamanager.com");
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

test("Ledgerline portal dispatch requires its own server-side gate and exact release confirmation", () => {
  const ledgerline = websites.find((site) => site.id === "quantum-ledgerline");
  const validCommit = "a".repeat(40);
  assert.equal(productionDispatchError(ledgerline, "false", validCommit, "DEPLOY")?.status, 423);
  assert.equal(productionDispatchError(ledgerline, "true", "short", "DEPLOY")?.status, 400);
  assert.equal(productionDispatchError(ledgerline, "true", validCommit, "DEPLOY"), null);
});

test("Quantum Visa Manager portal dispatch requires its own server-side gate and exact release confirmation", () => {
  const qvm = websites.find((site) => site.id === "quantum-visa-manager");
  const validCommit = "a".repeat(40);
  assert.equal(productionDispatchError(qvm, "true", validCommit, "DEPLOY", "false")?.status, 423);
  assert.equal(productionDispatchError(qvm, "false", validCommit, "DEPLOY", "true"), null);
  assert.equal(productionDispatchError(qvm, "true", "short", "DEPLOY", "true")?.status, 400);
  assert.equal(productionDispatchError(qvm, "true", validCommit, "DEPLOY", "true"), null);
  // Ledgerline gate must not authorize QVM when QVM gate is off.
  assert.equal(productionDispatchError(qvm, "true", validCommit, "DEPLOY", undefined)?.status, 423);
});

test("legacy sites remain unaffected by Ledgerline and QVM portal gates", () => {
  const hva = websites.find((site) => site.id === "hva");
  assert.equal(productionDispatchError(hva, "false", undefined, undefined, "false"), null);
});

test("Ledgerline release resolution is fixed to the trusted repository main ref and returns display metadata", async () => {
  const sha = "b".repeat(40);
  let request;
  const release = await resolveLedgerlineMainRelease({
    async request(route, parameters) {
      request = { route, parameters };
      return { data: { sha, commit: { message: "  Release candidate\nwith notes  ", committer: { date: "2026-10-16T10:00:00Z" } } } };
    },
  });
  assert.deepEqual(request, {
    route: "GET /repos/{owner}/{repo}/commits/{ref}",
    parameters: { owner: "HighVolt-Analytics", repo: "Ledgerline", ref: "main" },
  });
  assert.deepEqual(release, { sha, shortSha: sha.slice(0, 7), message: "Release candidate with notes", committedAt: "2026-10-16T10:00:00Z" });
});

test("Ledgerline release resolution rejects malformed GitHub commit metadata", async () => {
  await assert.rejects(
    resolveLedgerlineMainRelease({ async request() { return { data: { sha: "not-a-sha" } }; } }),
    /Invalid commit metadata/,
  );
});

test("Ledgerline confirmation accepts only the reviewed current main commit and explicit DEPLOY", () => {
  const sha = "c".repeat(40);
  assert.deepEqual(validateLedgerlineReleaseConfirmation(sha, "DEPLOY", sha), { ok: true });
  assert.deepEqual(validateLedgerlineReleaseConfirmation(sha, "DEPLOY", "d".repeat(40)), { ok: false, reason: "stale_release" });
  assert.deepEqual(validateLedgerlineReleaseConfirmation(sha, "deploy", sha), { ok: false, reason: "invalid_confirmation" });
  assert.deepEqual(validateLedgerlineReleaseConfirmation("short", "DEPLOY", sha), { ok: false, reason: "invalid_confirmation" });
});

test("Ledgerline dispatch rejects an active main deployment but ignores unrelated branches", () => {
  assert.equal(hasActiveMainDeployment([{ head_branch: "main", status: "queued" }]), true);
  assert.equal(hasActiveMainDeployment([{ head_branch: "main", status: "in_progress" }]), true);
  assert.equal(hasActiveMainDeployment([{ head_branch: "feature", status: "in_progress" }]), false);
  assert.equal(hasActiveMainDeployment([{ head_branch: "main", status: "completed" }]), false);
});

test("Ledgerline endpoints retain allowlist, same-origin, and server-side dispatch-gate checks", async () => {
  const deployRoute = await readFile(new URL("../app/api/deploy/route.ts", import.meta.url), "utf8");
  const releaseRoute = await readFile(new URL("../app/api/deploy/ledgerline-release/route.ts", import.meta.url), "utf8");
  assert.match(deployRoute, /requireApiAuth\(\)/);
  assert.match(deployRoute, /isSameOriginRequest\(/);
  assert.match(deployRoute, /LEDGERLINE_PORTAL_DISPATCH_ENABLED/);
  assert.match(releaseRoute, /requireApiAuth\(\)/);
  assert.match(deployRoute, /LEDGERLINE_OWNER/);
  assert.match(deployRoute, /LEDGERLINE_REPO/);
  assert.match(deployRoute, /LEDGERLINE_WORKFLOW/);
  assert.match(deployRoute, /ref:\s*website\.branch/);
  assert.doesNotMatch(deployRoute, /body\.(?:owner|repo|branch|workflow|workflowFile)/);
  assert.doesNotMatch(releaseRoute, /request\.json|searchParams/);
});

test("Quantum Visa Manager uses an independent release endpoint and portal dispatch gate", async () => {
  const deployRoute = await readFile(new URL("../app/api/deploy/route.ts", import.meta.url), "utf8");
  const releaseRoute = await readFile(new URL("../app/api/deploy/qvm-release/route.ts", import.meta.url), "utf8");
  assert.match(deployRoute, /QVM_PORTAL_DISPATCH_ENABLED/);
  assert.match(deployRoute, /QVM_OWNER/);
  assert.match(deployRoute, /QVM_REPO/);
  assert.match(deployRoute, /QVM_WORKFLOW/);
  assert.match(deployRoute, /release_commit:\s*body\.releaseCommit/);
  assert.match(deployRoute, /confirm_production:\s*"DEPLOY"/);
  assert.match(deployRoute, /deployer_email:\s*email/);
  assert.match(releaseRoute, /requireApiAuth\(\)/);
  assert.match(releaseRoute, /resolveQvmMainRelease/);
  assert.doesNotMatch(releaseRoute, /request\.json|searchParams/);
  assert.doesNotMatch(deployRoute, /QVM_PRODUCTION_CUTOVER_ENABLED/);
});

test("Quantum Visa Manager release resolution is fixed to Quantum-Visa-Manager main", async () => {
  const sha = "e".repeat(40);
  let request;
  const release = await resolveQvmMainRelease({
    async request(route, parameters) {
      request = { route, parameters };
      return { data: { sha, commit: { message: "QVM release", committer: { date: "2026-10-16T20:00:00Z" } } } };
    },
  });
  assert.deepEqual(request, {
    route: "GET /repos/{owner}/{repo}/commits/{ref}",
    parameters: { owner: "HighVolt-Analytics", repo: "Quantum-Visa-Manager", ref: "main" },
  });
  assert.equal(release.sha, sha);
  assert.equal(validateQvmReleaseConfirmation(sha, "DEPLOY", sha).ok, true);
  assert.equal(validateQvmReleaseConfirmation(sha, "DEPLOY", "f".repeat(40)).ok, false);
  assert.equal(hasActiveQvmMainDeployment([{ head_branch: "main", status: "queued" }]), true);
  assert.equal(hasActiveQvmMainDeployment([{ head_branch: "feature", status: "in_progress" }]), false);
});

test("Ledgerline job outcomes distinguish skipped, successful, failed, and rolled-back deployments", () => {
  assert.equal(classifyDeploymentJobs([{ name: "Build approved Ledgerline marketing site", conclusion: "skipped" }, { name: "Deploy and verify approved production release", conclusion: "skipped" }]), "Deployment Skipped");
  assert.equal(classifyDeploymentJobs([{ name: "Build approved Ledgerline marketing site", conclusion: "failure" }, { name: "Deploy and verify approved production release", conclusion: "skipped" }]), "Failed Before Deployment");
  assert.equal(classifyDeploymentJobs([{ name: "Deploy and verify approved production release", conclusion: "success" }]), "Success");
  assert.equal(classifyDeploymentJobs([{ name: "Deploy and verify approved production release", conclusion: "failure", steps: [{ name: "Capture and verify pre-deployment production backup", conclusion: "failure" }] }]), "Failed Before Deployment");
  assert.equal(classifyDeploymentJobs([{ name: "Deploy and verify approved production release", conclusion: "failure", steps: [{ name: "Overlay release without deleting unrelated or persistent files", conclusion: "failure" }] }]), "Failed During Deployment");
  assert.equal(classifyDeploymentJobs([{ name: "Deploy and verify approved production release", conclusion: "failure", steps: [{ name: "Restore pre-deployment snapshot after a release failure", conclusion: "success" }] }]), "Rolled Back Successfully");
  assert.equal(classifyDeploymentJobs([{ name: "Deploy and verify approved production release", conclusion: "failure", steps: [{ name: "Restore pre-deployment snapshot after a release failure", conclusion: "failure" }] }]), "Rollback Failed");
});

test("GitHub token access is server-only and is not logged or returned", async () => {
  const client = await readFile(new URL("../lib/github-client.ts", import.meta.url), "utf8");
  const statusRoute = await readFile(new URL("../app/api/status/route.ts", import.meta.url), "utf8");
  const deployRoute = await readFile(new URL("../app/api/deploy/route.ts", import.meta.url), "utf8");

  assert.match(client, /import ["']server-only["']/);
  assert.match(client, /process\.env\.GITHUB_TOKEN/);
  assert.doesNotMatch(client, /console\.(?:log|info|warn|error)/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_GITHUB_TOKEN|return\s+token/);
  assert.doesNotMatch(statusRoute, /GITHUB_TOKEN/);
  assert.doesNotMatch(deployRoute, /GITHUB_TOKEN/);
  assert.doesNotMatch(statusRoute, /token\s*:/i);
  assert.doesNotMatch(deployRoute, /token\s*:/i);
  assert.match(deployRoute, /LEDGERLINE_PORTAL_DISPATCH_ENABLED/);
  assert.doesNotMatch(deployRoute, /LEDGERLINE_PRODUCTION_CUTOVER_ENABLED/);
});
