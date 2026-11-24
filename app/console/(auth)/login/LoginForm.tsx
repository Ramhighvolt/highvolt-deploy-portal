"use client";

import { useState } from "react";

type Step = "credentials" | "verify" | "enroll" | "confirm" | "recovery-codes";

const input =
  "w-full rounded-lg border border-[#2a3548] bg-[#0f1623] px-3 py-2 text-sm text-[#f0f4f8] outline-none focus:border-[#60a5fa]";
const button =
  "w-full rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#1d4ed8]";

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Could not reach the server. Try again." } };
  }
}

export default function LoginForm() {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (data: Record<string, unknown>) => setError(typeof data.error === "string" ? data.error : "Something went wrong.");

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/console/login", { email, password });
    setPassword("");
    if (!r.ok) {
      fail(r.data);
    } else {
      setToken(String(r.data.mfa_token));
      if (r.data.step === "enroll") {
        const e2 = await post("/api/console/login/enroll", { mfa_token: r.data.mfa_token });
        if (e2.ok) {
          setSecret(String(e2.data.secret));
          setUri(String(e2.data.otpauth_uri));
          setStep("enroll");
        } else {
          fail(e2.data);
        }
      } else {
        setStep("verify");
      }
    }
    setBusy(false);
  }

  async function submitVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/console/login/mfa", useRecovery ? { mfa_token: token, recovery_code: code } : { mfa_token: token, code });
    if (r.ok) {
      window.location.assign("/console/clients");
      return;
    }
    fail(r.data);
    setCode("");
    setBusy(false);
  }

  async function submitConfirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/console/login/enroll/confirm", { mfa_token: token, code });
    if (r.ok) {
      setRecoveryCodes(Array.isArray(r.data.recovery_codes) ? (r.data.recovery_codes as string[]) : []);
      setSecret("");
      setUri("");
      setStep("recovery-codes");
    } else {
      fail(r.data);
      setCode("");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {step === "credentials" ? (
        <form onSubmit={submitCredentials} className="space-y-3">
          <label className="block text-sm text-[#8b9bb4]">
            Email
            <input className={input} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm text-[#8b9bb4]">
            Password
            <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className={button} disabled={busy} type="submit">
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === "verify" ? (
        <form onSubmit={submitVerify} className="space-y-3">
          <label className="block text-sm text-[#8b9bb4]">
            {useRecovery ? "Recovery code" : "6-digit code from your authenticator"}
            <input
              className={input}
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={useRecovery ? 40 : 6}
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
            />
          </label>
          <button className={button} disabled={busy} type="submit">
            {busy ? "Verifying…" : "Sign in"}
          </button>
          <button
            type="button"
            className="w-full text-xs text-[#60a5fa] hover:underline"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setCode("");
              setError("");
            }}
          >
            {useRecovery ? "Use my authenticator instead" : "I lost my authenticator: use a recovery code"}
          </button>
        </form>
      ) : null}

      {step === "enroll" ? (
        <div className="space-y-3 text-sm text-[#c5d0e0]">
          <p>Set up an authenticator app (Microsoft Authenticator, Google Authenticator, 1Password…). Add this key manually:</p>
          <code className="block break-all rounded-lg border border-[#2a3548] bg-[#0f1623] px-3 py-2 font-mono text-xs text-[#f0f4f8]" data-testid="totp-secret">
            {secret}
          </code>
          <p className="text-xs text-[#8b9bb4]">Or open this link on the device that has the app: <a className="text-[#60a5fa] underline" href={uri}>add to authenticator</a></p>
          <button className={button} type="button" onClick={() => setStep("confirm")}>
            I have added it
          </button>
        </div>
      ) : null}

      {step === "confirm" ? (
        <form onSubmit={submitConfirm} className="space-y-3">
          <label className="block text-sm text-[#8b9bb4]">
            Enter the 6-digit code now shown in the app
            <input className={input} inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.trim())} />
          </label>
          <button className={button} disabled={busy} type="submit">
            {busy ? "Confirming…" : "Confirm and sign in"}
          </button>
        </form>
      ) : null}

      {step === "recovery-codes" ? (
        <div className="space-y-3 text-sm text-[#c5d0e0]">
          <p className="font-semibold text-[#f0f4f8]">Save your recovery codes</p>
          <p>Each code works once if you lose your authenticator. They are shown only now. Store them in a password manager.</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-xs text-[#f0f4f8]" data-testid="recovery-codes">
            {recoveryCodes.map((c) => (
              <li key={c} className="rounded border border-[#2a3548] bg-[#0f1623] px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
          <button className={button} type="button" onClick={() => window.location.assign("/console/clients")}>
            I have saved them: continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
