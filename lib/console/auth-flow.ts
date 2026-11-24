import type { ConsoleConfig } from "./config.ts";
import { callService, type FetchLike } from "./service-client.ts";

export type Challenge = { step: "verify" | "enroll"; token: string; methods: string[] };
export type Tokens = { accessToken: string; refreshToken: string };
export type Fail = { ok: false; status: 400 | 401 | 502 };

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function failFor(upstream: number): Fail {
  if (upstream === 0 || upstream >= 500) return { ok: false, status: 502 };
  if (upstream === 400) return { ok: false, status: 400 };
  return { ok: false, status: 401 }; // every credential problem looks the same to the caller
}

/** Step one: the password. A success is never tokens, only a challenge for the second factor. */
export async function passwordLogin(
  f: FetchLike,
  cfg: ConsoleConfig,
  email: unknown,
  password: unknown,
): Promise<{ ok: true; challenge: Challenge } | Fail> {
  if (typeof email !== "string" || !EMAIL.test(email.trim()) || email.length > 254) return { ok: false, status: 400 };
  if (typeof password !== "string" || password.length === 0 || password.length > 1024) return { ok: false, status: 400 };
  const r = await callService(f, cfg.loginUrl, "/login", {
    method: "POST",
    json: { email: email.trim(), password, app_id: cfg.platformAppId },
  });
  const b = (r.body ?? {}) as Record<string, unknown>;
  const token = str(b.mfa_token);
  const step = b.mfa_step === "verify" || b.mfa_step === "enroll" ? b.mfa_step : null;
  if (r.status === 200 && token && step) {
    const methods = Array.isArray(b.mfa_methods) ? b.mfa_methods.filter((m): m is string => typeof m === "string") : [];
    return { ok: true, challenge: { step, token, methods } };
  }
  // A 200 without a challenge would mean the platform app is not protected by MFA: refuse rather than guess.
  return r.status === 200 ? { ok: false, status: 502 } : failFor(r.status);
}

export async function verifyMfa(
  f: FetchLike,
  cfg: ConsoleConfig,
  input: { token: unknown; code?: unknown; recoveryCode?: unknown },
): Promise<({ ok: true } & Tokens) | Fail> {
  const token = str(input.token);
  const code = typeof input.code === "string" && /^\d{6}$/.test(input.code) ? input.code : null;
  const recovery =
    typeof input.recoveryCode === "string" && input.recoveryCode.length > 0 && input.recoveryCode.length <= 40
      ? input.recoveryCode
      : null;
  if (!token || (!code && !recovery)) return { ok: false, status: 400 };
  const r = await callService(f, cfg.loginUrl, "/login/mfa", {
    method: "POST",
    json: code ? { mfa_token: token, code } : { mfa_token: token, recovery_code: recovery },
  });
  return tokensFrom(r.status, r.body);
}

export async function startEnroll(
  f: FetchLike,
  cfg: ConsoleConfig,
  token: unknown,
): Promise<{ ok: true; secret: string; otpauthUri: string } | Fail> {
  const t = str(token);
  if (!t) return { ok: false, status: 400 };
  const r = await callService(f, cfg.loginUrl, "/login/mfa/enroll", { method: "POST", json: { mfa_token: t } });
  const b = (r.body ?? {}) as Record<string, unknown>;
  const secret = str(b.secret);
  const uri = str(b.otpauth_uri);
  return r.status === 200 && secret && uri ? { ok: true, secret, otpauthUri: uri } : failFor(r.status || 0);
}

export async function confirmEnroll(
  f: FetchLike,
  cfg: ConsoleConfig,
  input: { token: unknown; code: unknown },
): Promise<({ ok: true; recoveryCodes: string[] } & Tokens) | Fail> {
  const token = str(input.token);
  if (!token || typeof input.code !== "string" || !/^\d{6}$/.test(input.code)) return { ok: false, status: 400 };
  const r = await callService(f, cfg.loginUrl, "/login/mfa/enroll/confirm", {
    method: "POST",
    json: { mfa_token: token, code: input.code },
  });
  const b = (r.body ?? {}) as Record<string, unknown>;
  const access = str(b.access_token);
  const refresh = str(b.refresh_token);
  const codes = Array.isArray(b.recovery_codes) ? b.recovery_codes.filter((c): c is string => typeof c === "string") : [];
  return r.status === 200 && access && refresh
    ? { ok: true, accessToken: access, refreshToken: refresh, recoveryCodes: codes }
    : failFor(r.status);
}

export async function refreshTokens(f: FetchLike, cfg: ConsoleConfig, refreshToken: string): Promise<({ ok: true } & Tokens) | Fail> {
  const r = await callService(f, cfg.loginUrl, "/refresh", { method: "POST", json: { refresh_token: refreshToken } });
  return tokensFrom(r.status, r.body);
}

/** Best effort: ending the upstream session must never block clearing the local cookies. */
export async function logoutUpstream(f: FetchLike, cfg: ConsoleConfig, refreshToken: string): Promise<void> {
  await callService(f, cfg.loginUrl, "/logout", { method: "POST", json: { refresh_token: refreshToken }, timeoutMs: 3000 });
}

function tokensFrom(status: number, body: unknown): ({ ok: true } & Tokens) | Fail {
  const b = (body ?? {}) as Record<string, unknown>;
  const access = str(b.access_token);
  const refresh = str(b.refresh_token);
  return status === 200 && access && refresh ? { ok: true, accessToken: access, refreshToken: refresh } : failFor(status);
}
