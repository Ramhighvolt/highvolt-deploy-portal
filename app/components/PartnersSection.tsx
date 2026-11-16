"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PartnerAccount } from "@/lib/partners-catalog";

type PartnersResponse = {
  success?: boolean;
  configured?: boolean;
  missing?: string[];
  partners?: PartnerAccount[];
  count?: number;
  error?: string;
};

const COUNTRY_LABELS: Record<string, string> = {
  AU: "Australia",
  NZ: "New Zealand",
  GB: "United Kingdom",
  US: "United States",
  SG: "Singapore",
  IN: "India",
};

function countryLabel(code: string) {
  const key = String(code || "").toUpperCase();
  return COUNTRY_LABELS[key] || code || "—";
}

function formatSignupDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PartnersSection() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PartnersResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/partners", { cache: "no-store" });
      if (response.status === 401) {
        setError("Unauthorized");
        setPayload(null);
        return;
      }
      const body = (await response.json().catch(() => null)) as PartnersResponse | null;
      if (!response.ok || !body) {
        setError(body?.error || "Unable to load partner accounts.");
        setPayload(body);
        return;
      }
      setPayload(body);
    } catch {
      setError("Unable to load partner accounts.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const partners = payload?.partners || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((row) =>
      [row.name, row.email, row.firm, row.type, row.country, countryLabel(row.country)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [partners, query]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sys-label text-[#6b7d96]">Ledgerline</p>
          <h2 className="mt-1 text-xl font-semibold text-[#f0f4f8]">Partner accounts</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#8b9bb4]">
            Read-only list of accounts created through Quantum Ledger Line{" "}
            <span className="font-mono text-[#a8b8cc]">/partnership/signup</span>. Passwords and
            sessions are never shown.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-[#2a3548] bg-[#1c2535] px-3 py-2 text-sm font-medium text-[#e8ecf1] hover:border-[#3b4a63]"
        >
          Refresh
        </button>
      </div>

      {payload && payload.configured === false ? (
        <div className="hv-panel rounded-xl border border-[#2a3548] p-4 text-sm text-[#8b9bb4]">
          Partners API is not configured. Missing:{" "}
          <span className="font-mono text-[#a8b8cc]">{(payload.missing || []).join(", ")}</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, firm…"
          className="min-w-[220px] flex-1 rounded-lg border border-[#2a3548] bg-[#0d1219] px-3 py-2 text-sm text-[#e8ecf1] placeholder:text-[#6b7d96]"
        />
        <p className="text-xs text-[#6b7d96]">
          {loading ? "Loading…" : `${filtered.length} of ${partners.length} accounts`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2a3548] bg-[#0d1219]/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#2a3548] bg-[#121925] text-xs uppercase tracking-wide text-[#6b7d96]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Work email</th>
                <th className="px-4 py-3 font-medium">Firm</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Partner type</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#6b7d96]">
                    No partner accounts to show.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => (
                <tr key={`${row.email}-${row.created}`} className="border-b border-[#1c2535] last:border-0">
                  <td className="px-4 py-3 text-[#f0f4f8]">{row.name || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#c5d0de]">{row.email || "—"}</td>
                  <td className="px-4 py-3 text-[#e8ecf1]">{row.firm || "—"}</td>
                  <td className="px-4 py-3 text-[#c5d0de]">{countryLabel(row.country)}</td>
                  <td className="px-4 py-3 text-[#c5d0de]">{row.type || "—"}</td>
                  <td className="px-4 py-3 text-[#c5d0de]">{formatSignupDate(row.created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
