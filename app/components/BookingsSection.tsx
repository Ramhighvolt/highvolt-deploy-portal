"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOKING_SITE_CARDS, type BookingSiteCard } from "@/lib/booking-catalog";
import { isLegacyBooking, parseBookingAnswers, siteAnswerRows } from "@/lib/booking-answers";

type Invitee = { role?: string; name?: string; email?: string; personId?: string };

type BookingRow = {
  bookingId?: string;
  site?: string;
  source?: string;
  readOnly?: boolean;
  market?: string;
  country?: string;
  reference?: string;
  slotStart?: string;
  slotDate?: string;
  timeZone?: string;
  state?: string;
  meetingStatus?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  organization?: string;
  invitees?: Invitee[];
  notifications?: Record<string, { status?: string; role?: string }>;
  answers?: Record<string, unknown>;
  answersOriginal?: string;
  answersPresent?: boolean;
};

type SiteResult = BookingSiteCard & { bookings?: BookingRow[]; readError?: string; legacyReadError?: string };
type MicrosoftBooking = { appointmentId?: string; customerName?: string; serviceName?: string; start?: string; readOnly?: boolean };

type CalendarDay = {
  key: string;
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  bookings: BookingRow[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VISIBLE_PER_DAY = 2;
const ASSIGNEES = ["lakshmi", "arup", "prachi", "sabina", "jasisca", "khushi"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function addMonths(year: number, month: number, delta: number) {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function bookingDayKey(row: BookingRow): string {
  if (row.slotDate && /^\d{4}-\d{2}-\d{2}$/.test(row.slotDate)) return row.slotDate;
  const raw = String(row.slotStart || "");
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return toDayKey(new Date(parsed));
  return "";
}

function siteLabel(siteId: string | undefined) {
  return BOOKING_SITE_CARDS.find((item) => item.id === siteId)?.label || siteId || "Unknown site";
}

function assigneeNames(row: BookingRow): string {
  const fromNotify = Object.keys(row.notifications || {});
  if (fromNotify.length) return fromNotify.join(", ");
  const fromInvitees = (row.invitees || [])
    .filter((person) => person.role && person.role !== "visitor" && person.role !== "organizer")
    .map((person) => person.personId || person.name || "")
    .filter(Boolean);
  return fromInvitees.length ? fromInvitees.join(", ") : "unassigned";
}

function formatWhen(row: BookingRow): string {
  const zone = row.timeZone || "";
  const start = row.slotStart || "";
  if (!start) return zone ? `time not stored (${zone})` : "time not stored";
  const parsed = Date.parse(start);
  if (!Number.isFinite(parsed)) return zone ? `${start} (${zone})` : start;
  try {
    const formatted = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zone || undefined,
    }).format(new Date(parsed));
    return zone ? `${formatted} (${zone})` : formatted;
  } catch {
    return zone ? `${start} (${zone})` : start;
  }
}

function formatChipTime(row: BookingRow): string {
  const start = row.slotStart || "";
  const parsed = Date.parse(start);
  if (!Number.isFinite(parsed)) return row.reference || "Booking";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: row.timeZone || undefined,
    }).format(new Date(parsed));
  } catch {
    return row.reference || "Booking";
  }
}

function bookingKindLabel(row: BookingRow): string {
  if (isLegacyBooking(row.source)) return "Legacy QVM (v1) · read only";
  return "New booking (v2)";
}

function buildMonthGrid(year: number, month: number, byDay: Map<string, BookingRow[]>): CalendarDay[] {
  const first = startOfMonth(year, month);
  const todayKey = toDayKey(new Date());
  // Monday-first index: JS Sunday=0 → 6, Monday=1 → 0
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = toDayKey(date);
    days.push({
      key,
      date,
      inMonth: date.getMonth() === month,
      isToday: key === todayKey,
      bookings: byDay.get(key) || [],
    });
  }
  return days;
}

function BookingDetailCard({
  row,
  onRecoverNote,
  legacyNote,
}: {
  row: BookingRow;
  onRecoverNote: (bookingId: string) => void;
  legacyNote: string;
}) {
  const answers = siteAnswerRows(row.site, row.answers || row.answersOriginal);
  const email =
    row.attendeeEmail ||
    String(parseBookingAnswers(row.answers || row.answersOriginal).email || "");

  return (
    <article className="rounded-xl border border-[#2a3548] bg-[#151c28] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium text-[#f0f4f8]">{row.reference || row.bookingId || "Booking"}</h4>
        <span
          className={[
            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
            isLegacyBooking(row.source) ? "border-amber-500/40 text-amber-200" : "border-[#2a3548] text-[#60a5fa]",
          ].join(" ")}
        >
          {bookingKindLabel(row)}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-[#8b9bb4] sm:grid-cols-2">
        <div>Site: {siteLabel(row.site)}</div>
        <div>Name: {row.attendeeName || "not stored"}</div>
        <div>Email: {email || "not stored"}</div>
        <div>Date and time: {formatWhen(row)}</div>
        <div>Assignee: {assigneeNames(row)}</div>
        <div>Status: {row.meetingStatus || row.state || "unknown"}</div>
      </dl>

      {!isLegacyBooking(row.source) ? (
        <div className="mt-4">
          <h5 className="text-sm font-medium text-[#f0f4f8]">Questions and answers</h5>
          {answers.length === 0 ? (
            <p className="mt-2 text-sm text-[#6b7d96]">No questionnaire answers were returned for this booking.</p>
          ) : (
            <dl className="mt-2 space-y-2">
              {answers.map((item) => (
                <div key={item.key} className="rounded-lg border border-[#2a3548] px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-[#6b7d96]">
                    {item.label}
                    {!item.recognized ? " · unrecognized field" : ""}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-[#f0f4f8]">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-amber-200">
            Legacy v1 bookings do not store the v2 questionnaire payload here. Use the private note action if a calendar note exists.
          </p>
          {row.bookingId ? (
            <button
              className="mt-3 rounded-lg border border-[#2a3548] px-3 py-2 text-sm text-[#f0f4f8]"
              type="button"
              onClick={() => onRecoverNote(row.bookingId || "")}
            >
              Read private note
            </button>
          ) : null}
          {legacyNote ? <p className="mt-3 whitespace-pre-wrap text-sm text-[#f0f4f8]">{legacyNote}</p> : null}
        </div>
      )}
    </article>
  );
}

export default function BookingsSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [site, setSite] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sites, setSites] = useState<SiteResult[]>(BOOKING_SITE_CARDS);
  const [missing, setMissing] = useState<string[]>([]);
  const [legacyMissing, setLegacyMissing] = useState<string[]>([]);
  const [legacyReadError, setLegacyReadError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [microsoftBookings, setMicrosoftBookings] = useState<MicrosoftBooking[]>([]);
  const [popupRows, setPopupRows] = useState<BookingRow[] | null>(null);
  const [popupTitle, setPopupTitle] = useState("");
  const [detailCache, setDetailCache] = useState<Record<string, BookingRow>>({});
  const [legacyNote, setLegacyNote] = useState("");
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const applyBookingsPayload = useCallback((response: Response, body: Record<string, unknown> | null) => {
    if (!response.ok || !body?.success) {
      setError("The booking view could not be loaded.");
      return;
    }
    setError("");
    setConfigured(Boolean(body.configured));
    setMissing((body.missing as string[]) || []);
    const upstream = body.upstream as Record<string, unknown> | undefined;
    setLegacyMissing((upstream?.legacyMissing as string[]) || (body.legacyMissing as string[]) || []);
    setLegacyReadError(String(upstream?.legacyReadError || body.legacyReadError || ""));
    const microsoft = body.microsoftBookings as { appointments?: MicrosoftBooking[] } | undefined;
    setMicrosoftBookings(Array.isArray(microsoft?.appointments) ? microsoft.appointments : []);
    const nextSites = body.sites as SiteResult[] | undefined;
    setSites(Array.isArray(nextSites) && nextSites.length ? nextSites : BOOKING_SITE_CARDS);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (site) params.set("site", site);
      if (assignee) params.set("assignee", assignee);
      const response = await fetch(`/api/bookings?${params.toString()}`, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      applyBookingsPayload(response, body);
    } finally {
      setLoading(false);
    }
  }, [site, assignee, applyBookingsPayload]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (site) params.set("site", site);
    if (assignee) params.set("assignee", assignee);
    void (async () => {
      const response = await fetch(`/api/bookings?${params.toString()}`, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (cancelled) return;
      applyBookingsPayload(response, body);
    })();
    return () => {
      cancelled = true;
    };
  }, [site, assignee, applyBookingsPayload]);

  const allBookings = useMemo(() => {
    const rows: BookingRow[] = [];
    for (const item of sites) {
      for (const row of item.bookings || []) {
        rows.push({ ...row, site: row.site || item.id });
      }
    }
    return rows;
  }, [sites]);

  const monthBookings = useMemo(() => {
    const prefix = `${year}-${pad2(month + 1)}-`;
    return allBookings.filter((row) => bookingDayKey(row).startsWith(prefix));
  }, [allBookings, year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const row of monthBookings) {
      const key = bookingDayKey(row);
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(a.slotStart || "").localeCompare(String(b.slotStart || "")));
    }
    return map;
  }, [monthBookings]);

  const days = useMemo(() => buildMonthGrid(year, month, byDay), [year, month, byDay]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, month, 1)),
    [year, month],
  );

  const legacyRows = useMemo(
    () => allBookings.filter((row) => isLegacyBooking(row.source)),
    [allBookings],
  );

  async function enrichRows(rows: BookingRow[]) {
    const next = { ...detailCache };
    await Promise.all(
      rows.map(async (row) => {
        if (isLegacyBooking(row.source) || !row.site || !row.bookingId) return;
        const cacheKey = `${row.site}:${row.bookingId}`;
        if (next[cacheKey]) return;
        const detail = await fetch(
          `/api/bookings/detail?site=${encodeURIComponent(row.site)}&bookingId=${encodeURIComponent(row.bookingId)}`,
          { cache: "no-store" },
        );
        const body = await detail.json().catch(() => null);
        const booking = body?.upstream?.booking as BookingRow | undefined;
        if (booking) next[cacheKey] = booking;
      }),
    );
    setDetailCache(next);
    return rows.map((row) => {
      if (!row.site || !row.bookingId) return row;
      return next[`${row.site}:${row.bookingId}`] || row;
    });
  }

  async function openPopup(rows: BookingRow[], title: string) {
    setLegacyNote("");
    setPopupTitle(title);
    setPopupRows(rows);
    const enriched = await enrichRows(rows);
    setPopupRows(enriched);
  }

  function closePopup() {
    setPopupRows(null);
    setPopupTitle("");
    setLegacyNote("");
  }

  useEffect(() => {
    if (!popupRows) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closePopup();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popupRows]);

  async function recoverNote(bookingId: string) {
    const response = await fetch(`/api/bookings/legacy-note?bookingId=${encodeURIComponent(bookingId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setLegacyNote(body?.status === "unconfigured" ? "Legacy note recovery is not configured." : "The note could not be read.");
      return;
    }
    setLegacyNote(
      body?.upstream?.status === "recovered"
        ? body.upstream.body || "Note recovered with an empty body."
        : "No private note was found. No meeting was created.",
    );
  }

  function goToday() {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-5">
        <p className="font-medium text-amber-200">Booking v2 is not enabled</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-200/70">
          Every site switch stays off. HighVolt remains integration pending. This view does not create bookings or calendar events.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-[#2a3548] px-3 py-2 text-sm text-[#f0f4f8]"
            type="button"
            onClick={() => {
              const next = addMonths(year, month, -1);
              setYear(next.year);
              setMonth(next.month);
            }}
          >
            Previous month
          </button>
          <button className="rounded-lg border border-[#2a3548] px-3 py-2 text-sm text-[#f0f4f8]" type="button" onClick={goToday}>
            Today
          </button>
          <button
            className="rounded-lg border border-[#2a3548] px-3 py-2 text-sm text-[#f0f4f8]"
            type="button"
            onClick={() => {
              const next = addMonths(year, month, 1);
              setYear(next.year);
              setMonth(next.month);
            }}
          >
            Next month
          </button>
          <h2 className="ml-1 text-lg font-semibold text-[#f0f4f8]">{monthLabel}</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm text-[#8b9bb4]">
            Site
            <select
              className="mt-1 w-full rounded-lg border border-[#2a3548] bg-[#1c2535] px-3 py-2 text-[#f0f4f8]"
              value={site}
              onChange={(event) => setSite(event.target.value)}
            >
              <option value="">All</option>
              {BOOKING_SITE_CARDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#8b9bb4]">
            Assignee
            <select
              className="mt-1 w-full rounded-lg border border-[#2a3548] bg-[#1c2535] px-3 py-2 text-[#f0f4f8]"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">All</option>
              {ASSIGNEES.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded-lg bg-[#3b82f6] px-4 py-2 text-sm font-medium text-white"
            type="button"
            onClick={() => void load()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {!configured && missing.length > 0 ? (
        <p className="text-sm text-[#8b9bb4]">Not connected. Missing {missing.join(", ")}. No appointments are shown.</p>
      ) : null}
      {legacyReadError || legacyMissing.length > 0 ? (
        <p className="text-sm text-amber-200">
          Legacy QVM table read: {legacyReadError || "unavailable"}
          {legacyMissing.length ? ` (missing ${legacyMissing.join(", ")})` : ""}. New v2 bookings are still shown separately.
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="overflow-x-auto rounded-xl border border-[#2a3548] bg-[#151c28]">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-[#2a3548]">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-3 text-center text-xs font-medium uppercase tracking-wide text-[#6b7d96]">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const visible = day.bookings.slice(0, VISIBLE_PER_DAY);
              const overflow = day.bookings.length - visible.length;
              return (
                <div
                  key={day.key}
                  className={[
                    "min-h-[110px] border-b border-r border-[#2a3548] p-2 sm:min-h-[130px]",
                    day.inMonth ? "bg-[#151c28]" : "bg-[#101620] opacity-55",
                    day.isToday ? "ring-1 ring-inset ring-[#3b82f6]" : "",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <span className={["text-xs font-medium", day.isToday ? "text-[#60a5fa]" : "text-[#8b9bb4]"].join(" ")}>
                      {day.date.getDate()}
                    </span>
                    {day.bookings.length > 0 ? (
                      <span className="text-[10px] text-[#6b7d96]">{day.bookings.length}</span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {visible.map((row) => (
                      <button
                        key={`${row.site}-${row.bookingId || row.reference || row.slotStart}`}
                        className={[
                          "block w-full truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight",
                          isLegacyBooking(row.source)
                            ? "bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                            : "bg-[#1c2535] text-[#dbe7f5] hover:bg-[#243044]",
                        ].join(" ")}
                        type="button"
                        title={`${siteLabel(row.site)} · ${row.attendeeName || "Visitor"}`}
                        onClick={() => void openPopup([row], `${siteLabel(row.site)} · ${formatWhen(row)}`)}
                      >
                        <span className="font-medium">{formatChipTime(row)}</span>
                        <span className="ml-1 opacity-80">{row.attendeeName || siteLabel(row.site)}</span>
                      </button>
                    ))}
                    {overflow > 0 ? (
                      <button
                        className="w-full rounded px-1.5 py-1 text-left text-[11px] font-medium text-[#60a5fa] hover:bg-[#1c2535]"
                        type="button"
                        onClick={() =>
                          void openPopup(
                            day.bookings,
                            `${day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${day.bookings.length} bookings`,
                          )
                        }
                      >
                        +{overflow} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="hv-card rounded-xl p-5">
        <h3 className="font-semibold text-[#f0f4f8]">Legacy QVM bookings (v1)</h3>
        <p className="mt-2 text-sm text-[#8b9bb4]">Read only. These stay separate from the month grid chips that also include them when dated.</p>
        <ul className="mt-4 space-y-2">
          {legacyRows.length === 0 ? (
            <li className="text-sm text-[#6b7d96]">No legacy bookings.</li>
          ) : (
            legacyRows.map((row) => (
              <li key={row.bookingId || row.reference}>
                <button
                  className="w-full rounded-lg border border-amber-500/30 px-3 py-2 text-left text-sm hover:border-amber-300"
                  type="button"
                  onClick={() => void openPopup([row], `Legacy · ${row.reference || row.bookingId || "booking"}`)}
                >
                  <span className="text-[#f0f4f8]">{row.reference || row.bookingId}</span>
                  <span className="mt-1 block text-[#8b9bb4]">
                    {formatWhen(row)} · {row.meetingStatus || row.state || "unknown"} · legacy v1
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="hv-card rounded-xl p-5">
        <h3 className="font-semibold text-[#f0f4f8]">Existing Microsoft Bookings</h3>
        <p className="mt-2 text-sm text-[#8b9bb4]">Read only. These appointments are not copied and no meeting is created from this list.</p>
        <ul className="mt-4 space-y-2">
          {microsoftBookings.length === 0 ? (
            <li className="text-sm text-[#6b7d96]">No Microsoft Bookings appointments are loaded.</li>
          ) : (
            microsoftBookings.map((row) => (
              <li key={row.appointmentId || row.start} className="rounded-lg border border-[#2a3548] px-3 py-2 text-sm text-[#8b9bb4]">
                {row.customerName || "Visitor"} · {row.serviceName || "Appointment"} · {row.start || "time not stored"} · read only
              </li>
            ))
          )}
        </ul>
      </section>

      {sites.some((item) => item.readError) ? (
        <section className="rounded-xl border border-[#2a3548] p-4 text-sm text-[#8b9bb4]">
          {sites
            .filter((item) => item.readError)
            .map((item) => (
              <p key={item.id} className="mt-1">
                {item.label}: {item.readError}
                {item.legacyReadError ? ` · legacy ${item.legacyReadError}` : ""}
              </p>
            ))}
        </section>
      ) : null}

      {popupRows ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePopup();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={popupTitle || "Booking details"}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#2a3548] bg-[#0f1520] p-4 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#f0f4f8]">{popupTitle || "Booking details"}</h3>
                <p className="mt-1 text-sm text-[#8b9bb4]">{popupRows.length} booking{popupRows.length === 1 ? "" : "s"}</p>
              </div>
              <button
                className="rounded-lg border border-[#2a3548] px-3 py-1.5 text-sm text-[#f0f4f8]"
                type="button"
                onClick={closePopup}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {popupRows.map((row) => (
                <BookingDetailCard
                  key={`${row.site}-${row.bookingId || row.reference || row.slotStart}`}
                  row={row}
                  onRecoverNote={(bookingId) => void recoverNote(bookingId)}
                  legacyNote={legacyNote}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
