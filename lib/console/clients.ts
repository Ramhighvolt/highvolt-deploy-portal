import type { ConsoleConfig } from "./config.ts";
import { callService, type FetchLike } from "./service-client.ts";

export type ClientRow = {
  orgId: string;
  displayName: string;
  status: string;
  apps: string[];
  memberCount: number;
  createdAt: string | null;
  planCode: string | null;
  entitlementStatus: string | null;
  modules: string[] | null;
  entitlementVersion: number | null;
};

export type ClientPage = {
  rows: ClientRow[];
  nextCursor: string | null;
  /** False when the entitlement service could not be reached: the list still shows, modules are unknown. */
  entitlementsAvailable: boolean;
};

export type UpstreamFailure = { ok: false; upstream: number };

const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const MODULE = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const STATUSES = new Set(["active", "suspended", "deleted"]);

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function row(org: Json, ent: Json | undefined): ClientRow {
  return {
    orgId: String(org.org_id ?? ""),
    displayName: String(org.display_name ?? org.org_id ?? ""),
    status: String(org.status ?? "active"),
    apps: strings(org.apps),
    memberCount: typeof org.member_count === "number" ? org.member_count : 0,
    createdAt: typeof org.created_at === "string" ? org.created_at : null,
    planCode: ent ? String(ent.plan_code ?? "") || null : null,
    entitlementStatus: ent ? String(ent.status ?? "") || null : null,
    modules: ent ? strings(ent.features) : null,
    entitlementVersion: ent && typeof ent.version === "number" ? ent.version : null,
  };
}

export type ListQuery = { q?: string; status?: string; cursor?: string; limit?: number };

/**
 * One page of this product's clients: who they are (the directory) joined with which modules they have (the
 * entitlements), both fetched with the operator's own token so the platform sees, authorises and audits the person.
 */
export async function listClients(
  f: FetchLike,
  cfg: ConsoleConfig,
  token: string,
  query: ListQuery,
): Promise<({ ok: true } & ClientPage) | UpstreamFailure | { ok: false; upstream: 400 }> {
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 25), 1), 100);
  const params = new URLSearchParams({ limit: String(limit), app_id: cfg.appId });
  if (query.status) {
    if (!STATUSES.has(query.status)) return { ok: false, upstream: 400 };
    params.set("status", query.status);
  }
  if (query.q && query.q.trim()) params.set("q", query.q.trim().slice(0, 100));
  if (query.cursor) params.set("cursor", query.cursor.slice(0, 200));

  const dir = await callService(f, cfg.loginUrl, `/restricted/v1/platform/orgs?${params}`, { token });
  if (dir.status !== 200) return { ok: false, upstream: dir.status };
  const body = obj(dir.body);
  const orgs = (Array.isArray(body.data) ? body.data : []).map(obj);
  const next = obj(body.page).next_cursor;

  const ids = orgs.map((o) => String(o.org_id ?? "")).filter((id) => ID.test(id));
  const byId = new Map<string, Json>();
  let available = true;
  if (ids.length > 0) {
    const ent = await callService(
      f,
      cfg.commerceUrl,
      `/restricted/v1/apps/${cfg.appId}/entitlements?customer_ids=${encodeURIComponent(ids.join(","))}&limit=100`,
      { token },
    );
    if (ent.status === 200) {
      (Array.isArray(obj(ent.body).data) ? (obj(ent.body).data as unknown[]) : []).map(obj).forEach((e) => {
        byId.set(String(e.customer_id ?? ""), e);
      });
    } else {
      available = false;
    }
  }
  return {
    ok: true,
    rows: orgs.map((o) => row(o, byId.get(String(o.org_id ?? "")))),
    nextCursor: typeof next === "string" ? next : null,
    entitlementsAvailable: available,
  };
}

export type ClientDetail = { client: ClientRow; etag: string | null };

export async function getClient(
  f: FetchLike,
  cfg: ConsoleConfig,
  token: string,
  orgId: string,
): Promise<({ ok: true } & ClientDetail & { entitlementsAvailable: boolean }) | UpstreamFailure> {
  if (!ID.test(orgId)) return { ok: false, upstream: 404 };
  const dir = await callService(f, cfg.loginUrl, `/restricted/v1/platform/orgs/${orgId}`, { token });
  if (dir.status !== 200) return { ok: false, upstream: dir.status };
  const ent = await callService(f, cfg.commerceUrl, `/restricted/v1/customers/${orgId}/apps/${cfg.appId}/entitlement`, {
    token,
  });
  const found = ent.status === 200 ? obj(ent.body) : undefined;
  return {
    ok: true,
    client: row(obj(dir.body), found),
    etag: ent.status === 200 ? ent.etag : null,
    entitlementsAvailable: ent.status === 200 || ent.status === 404,
  };
}

export type ToggleInput = { orgId: string; module: string; state: unknown; reason: unknown; version: unknown };

/** Validates before calling, so the platform only ever sees well-formed requests. */
export async function setModule(
  f: FetchLike,
  cfg: ConsoleConfig,
  token: string,
  input: ToggleInput,
): Promise<{ ok: true; changed: boolean; version: number | null } | UpstreamFailure> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const version = typeof input.version === "number" && Number.isInteger(input.version) && input.version >= 0 ? input.version : null;
  if (
    !ID.test(input.orgId) ||
    !MODULE.test(input.module) ||
    (input.state !== "enabled" && input.state !== "disabled") ||
    reason.length < 5 ||
    reason.length > 500 ||
    version === null
  ) {
    return { ok: false, upstream: 400 };
  }
  const r = await callService(
    f,
    cfg.commerceUrl,
    `/restricted/v1/customers/${input.orgId}/apps/${cfg.appId}/entitlement/modules/${input.module}`,
    { method: "PUT", token, json: { state: input.state, reason }, headers: { "if-match": `"${version}"` } },
  );
  if (r.status !== 200) return { ok: false, upstream: r.status };
  const b = obj(r.body);
  return { ok: true, changed: b.changed === true, version: typeof b.version === "number" ? b.version : null };
}
