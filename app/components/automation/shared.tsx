"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isRunActive,
  runOutcome,
  type RunSummary,
  type SuiteId,
} from "@/lib/automation-catalog";

/* ------------------------------ API ------------------------------ */

export async function api<T>(
  input: string,
  init?: RequestInit,
): Promise<T & { success: true }> {
  const res = await fetch(input, { cache: "no-store", ...init });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Request failed (HTTP ${res.status})`);
  }
  return data;
}

export function postJson<T>(url: string, body: unknown) {
  return api<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ---------------------- Live run polling ------------------------- */

/**
 * Polls GitHub Actions runs for a suite. Fast (4s) while anything is running or
 * a launch was just made, relaxed (20s) otherwise, paused while the tab is hidden.
 */
export function useLiveRuns(suite: SuiteId, workflows?: string[]) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const boostUntil = useRef(0);
  const runsRef = useRef<RunSummary[]>([]);
  const key = workflows?.join(",") ?? "";

  const refresh = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ suite });
      (key ? key.split(",") : []).forEach((w) => qs.append("workflow", w));
      const data = await api<{ runs: RunSummary[] }>(`/api/automation/runs?${qs}`);
      runsRef.current = data.runs;
      setRuns(data.runs);
      setError(null);
      setLastSync(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load runs");
    } finally {
      setLoading(false);
    }
  }, [suite, key]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await refresh();
      const active =
        runsRef.current.some(isRunActive) || Date.now() < boostUntil.current;
      timer = window.setTimeout(tick, active ? 4000 : 20000);
    };
    void tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  /** Call right after dispatching so new runs show up within seconds. */
  const boost = useCallback(() => {
    boostUntil.current = Date.now() + 90_000;
    void refresh();
    window.setTimeout(() => void refresh(), 2500);
  }, [refresh]);

  return { runs, error, loading, lastSync, refresh, boost };
}

/** Re-render every second (for live elapsed timers). */
export function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

/* ------------------------- Formatting --------------------------- */

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function runElapsed(run: RunSummary, now: number): number {
  const start = new Date(run.startedAt ?? run.createdAt).getTime();
  const end = run.status === "completed" ? new Date(run.updatedAt).getTime() : now;
  return end - start;
}

/* --------------------------- Shared UI --------------------------- */

const OUTCOME_STYLE = {
  queued: { label: "Queued", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", dot: "bg-amber-400 pipeline-active" },
  running: { label: "Running", cls: "border-blue-500/30 bg-blue-500/10 text-blue-300", dot: "bg-blue-400 pipeline-active" },
  success: { label: "Passed", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  failed: { label: "Failed", cls: "border-red-500/30 bg-red-500/10 text-red-300", dot: "bg-red-400" },
  cancelled: { label: "Cancelled", cls: "border-[#2a3548] bg-white/5 text-[#8b9bb4]", dot: "bg-[#6b7d96]" },
} as const;

export function RunStatusPill({
  run,
  labels,
}: {
  run: Pick<RunSummary, "status" | "conclusion">;
  labels?: Partial<Record<keyof typeof OUTCOME_STYLE, string>>;
}) {
  const o = runOutcome(run);
  const s = OUTCOME_STYLE[o];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {labels?.[o] ?? s.label}
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg border border-[#2a3548] bg-[#0d1219] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            value === o.id
              ? "nav-active shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
              : "text-[#8b9bb4] hover:text-[#e8ecf1]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sys-label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-[#6b7d96]">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-[#2a3548] bg-[#0d1219] px-3 py-2.5 text-sm text-[#f0f4f8] placeholder:text-[#4b5b73] focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/40 disabled:opacity-50";

export function Toast({
  tone,
  children,
  onClose,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const cls =
    tone === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : "border-blue-500/30 bg-blue-500/10 text-blue-200";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${cls}`}>
      <div className="min-w-0">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="shrink-0 text-current opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}
