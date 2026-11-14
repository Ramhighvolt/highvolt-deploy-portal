"use client";

import { useState } from "react";
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

function bookingKindLabel(row: BookingRow): string {
  if (isLegacyBooking(row.source)) return "Legacy QVM (v1) · read only";
  return "New booking (v2)";
}

function listSourceLabel(row: BookingRow): string {
  if (isLegacyBooking(row.source)) return " · legacy v1";
  return " · v2";
}

export default function BookingsSection() {
  const [date, setDate] = useState("");
  const [site, setSite] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sites, setSites] = useState<SiteResult[]>(BOOKING_SITE_CARDS);
  const [missing, setMissing] = useState<string[]>([]);
  const [legacyMissing, setLegacyMissing] = useState<string[]>([]);
  const [legacyReadError, setLegacyReadError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [legacyNote, setLegacyNote] = useState("");
  const [error, setError] = useState("");
  const [microsoftBookings, setMicrosoftBookings] = useState<MicrosoftBooking[]>([]);

  async function load() {
    setError("");
    setSelected(null);
    setLegacyNote("");
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (site) params.set("site", site);
    if (assignee) params.set("assignee", assignee);
    const response = await fetch(`/api/bookings?${params.toString()}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setError("The booking view could not be loaded.");
      return;
    }
    setConfigured(Boolean(body.configured));
    setMissing(body.missing || []);
    setLegacyMissing(body.upstream?.legacyMissing || body.legacyMissing || []);
    setLegacyReadError(body.upstream?.legacyReadError || body.legacyReadError || "");
    setMicrosoftBookings(Array.isArray(body.microsoftBookings?.appointments) ? body.microsoftBookings.appointments : []);
    // Prefer the server-combined catalog cards (labels, switch notes, legacyReadError).
    setSites(Array.isArray(body.sites) && body.sites.length ? body.sites : BOOKING_SITE_CARDS);
  }

  async function openBooking(row: BookingRow) {
    setSelected(row);
    setLegacyNote("");
    if (isLegacyBooking(row.source) || !row.site || !row.bookingId) return;
    const detail = await fetch(`/api/bookings/detail?site=${encodeURIComponent(row.site)}&bookingId=${encodeURIComponent(row.bookingId)}`, { cache: "no-store" });
    const body = await detail.json().catch(() => null);
    const booking = body?.upstream?.booking;
    if (booking) setSelected(booking);
  }

  async function recoverNote(bookingId: string) {
    const response = await fetch(`/api/bookings/legacy-note?bookingId=${encodeURIComponent(bookingId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setLegacyNote(body?.status === "unconfigured" ? "Legacy note recovery is not configured." : "The note could not be read.");
      return;
    }
    setLegacyNote(body?.upstream?.status === "recovered" ? body.upstream.body || "Note recovered with an empty body." : "No private note was found. No meeting was created.");
  }

  const selectedAnswers = selected
    ? siteAnswerRows(selected.site, selected.answers || selected.answersOriginal)
    : [];
  const selectedEmail =
    selected?.attendeeEmail ||
    String(parseBookingAnswers(selected?.answers || selected?.answersOriginal).email || "");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-5">
        <p className="font-medium text-amber-200">Booking v2 is not enabled</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-200/70">
          Every site switch stays off. HighVolt remains integration pending. This view does not create bookings or calendar events.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm text-[#8b9bb4]">Date
          <input className="mt-1 w-full rounded-lg border border-[#2a3548] bg-[#1c2535] px-3 py-2 text-[#f0f4f8]" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="text-sm text-[#8b9bb4]">Site
          <select className="mt-1 w-full rounded-lg border border-[#2a3548] bg-[#1c2535] px-3 py-2 text-[#f0f4f8]" value={site} onChange={(event) => setSite(event.target.value)}>
            <option value="">All</option>
            {BOOKING_SITE_CARDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-[#8b9bb4]">Assignee
          <select className="mt-1 w-full rounded-lg border border-[#2a3548] bg-[#1c2535] px-3 py-2 text-[#f0f4f8]" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">All</option>
            {["lakshmi", "arup", "prachi", "sabina", "jasisca", "khushi"].map((person) => <option key={person} value={person}>{person}</option>)}
          </select>
        </label>
        <button className="self-end rounded-lg bg-[#3b82f6] px-4 py-2 text-sm font-medium text-white" type="button" onClick={() => void load()}>Refresh</button>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {sites.map((item) => {
          const legacyRows = (item.bookings || []).filter((row) => isLegacyBooking(row.source));
          const v2Rows = (item.bookings || []).filter((row) => !isLegacyBooking(row.source));
          return (
            <article key={item.id} className="hv-card rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[#f0f4f8]">{item.label || item.domain}</h3>
                <span className="rounded-full border border-[#2a3548] px-2 py-1 text-xs uppercase tracking-wide text-[#60a5fa]">{item.status.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-2 text-sm text-[#8b9bb4]">{item.note || item.domain}</p>
              {item.readError && !v2Rows.length ? <p className="mt-2 text-sm text-rose-300">This site&apos;s v2 database could not be read. The other sites are still shown.</p> : null}
              {item.readError && v2Rows.length === 0 && legacyRows.length > 0 ? (
                <p className="mt-2 text-sm text-amber-200">The new database for this site could not be read. Legacy records below are read only.</p>
              ) : null}
              {item.legacyReadError ? (
                <p className="mt-2 text-sm text-amber-200">Legacy QVM rows could not be loaded ({item.legacyReadError}).</p>
              ) : null}

              <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-[#6b7d96]">New bookings (v2)</h4>
              <ul className="mt-2 space-y-2">
                {v2Rows.length === 0 ? <li className="text-sm text-[#6b7d96]">No v2 bookings.</li> : v2Rows.map((row) => (
                  <li key={row.bookingId}>
                    <button className="w-full rounded-lg border border-[#2a3548] px-3 py-2 text-left text-sm hover:border-[#60a5fa]" type="button" onClick={() => void openBooking(row)}>
                      <span className="text-[#f0f4f8]">{row.reference || row.bookingId}</span>
                      <span className="mt-1 block text-[#8b9bb4]">{row.slotStart} · {row.meetingStatus || row.state}{listSourceLabel(row)}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {item.id === "qvm" ? (
                <>
                  <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-[#6b7d96]">Legacy QVM bookings (v1)</h4>
                  <ul className="mt-2 space-y-2">
                    {legacyRows.length === 0 ? <li className="text-sm text-[#6b7d96]">No legacy bookings.</li> : legacyRows.map((row) => (
                      <li key={row.bookingId}>
                        <button className="w-full rounded-lg border border-amber-500/30 px-3 py-2 text-left text-sm hover:border-amber-300" type="button" onClick={() => void openBooking(row)}>
                          <span className="text-[#f0f4f8]">{row.reference || row.bookingId}</span>
                          <span className="mt-1 block text-[#8b9bb4]">{row.slotStart} · {row.meetingStatus || row.state}{listSourceLabel(row)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </article>
          );
        })}
      </div>

      <section className="hv-card rounded-xl p-5">
        <h3 className="font-semibold text-[#f0f4f8]">Existing Microsoft Bookings</h3>
        <p className="mt-2 text-sm text-[#8b9bb4]">Read only. These appointments are not copied and no meeting is created from this list.</p>
        <ul className="mt-4 space-y-2">
          {microsoftBookings.length === 0 ? <li className="text-sm text-[#6b7d96]">No Microsoft Bookings appointments are loaded.</li> : microsoftBookings.map((row) => (
            <li key={row.appointmentId || row.start} className="rounded-lg border border-[#2a3548] px-3 py-2 text-sm text-[#8b9bb4]">
              {row.customerName || "Visitor"} · {row.serviceName || "Appointment"} · {row.start || "time not stored"} · read only
            </li>
          ))}
        </ul>
      </section>

      {selected ? (
        <section className="hv-panel-light rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#f0f4f8]">{selected.reference || selected.bookingId}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide ${isLegacyBooking(selected.source) ? "border-amber-500/40 text-amber-200" : "border-[#2a3548] text-[#60a5fa]"}`}>
              {bookingKindLabel(selected)}
            </span>
          </div>

          <h4 className="mt-4 text-sm font-medium text-[#f0f4f8]">Summary</h4>
          <dl className="mt-3 grid gap-2 text-sm text-[#8b9bb4] sm:grid-cols-2">
            <div>Site: {selected.site || "unknown"}</div>
            <div>Name: {selected.attendeeName || "not stored"}</div>
            <div>Email: {selectedEmail || "not stored"}</div>
            <div>Organisation: {selected.organization || "not stored"}</div>
            <div>Appointment time: {selected.slotStart || "not stored"}</div>
            <div>Timezone: {selected.timeZone || "not stored"}</div>
            <div>Status: {selected.meetingStatus || selected.state || "unknown"}</div>
            <div>Country: {selected.country || "not stored"}</div>
            <div>Market: {selected.market || "unknown"}</div>
            <div>Source: {selected.source || "site-form"}</div>
          </dl>

          {selected.meetingStatus === "create_unconfirmed" ? (
            <p className="mt-3 text-sm text-amber-200">Calendar creation was not confirmed. It is not submitted again. The reconciler keeps looking up the event.</p>
          ) : null}

          {!isLegacyBooking(selected.source) ? (
            <>
              <h4 className="mt-5 text-sm font-medium text-[#f0f4f8]">Questions and answers</h4>
              <p className="mt-1 text-sm text-[#8b9bb4]">
                Labels follow the {selected.site || "site"} booking form. Only submitted answers are shown.
              </p>
              {selectedAnswers.length === 0 ? (
                <p className="mt-3 text-sm text-[#6b7d96]">No questionnaire answers were returned for this booking.</p>
              ) : (
                <dl className="mt-3 space-y-3">
                  {selectedAnswers.map((row) => (
                    <div key={row.key} className="rounded-lg border border-[#2a3548] px-3 py-2">
                      <dt className="text-xs uppercase tracking-wide text-[#6b7d96]">
                        {row.label}
                        {!row.recognized ? " · unrecognized field" : ""}
                      </dt>
                      <dd className="mt-1 text-sm text-[#f0f4f8] whitespace-pre-wrap">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-amber-200">
              Legacy v1 bookings do not store the v2 questionnaire payload here. Use the private note action if a calendar note exists.
            </p>
          )}

          <h4 className="mt-5 text-sm font-medium text-[#f0f4f8]">Invitees</h4>
          <ul className="mt-2 space-y-1 text-sm text-[#8b9bb4]">
            {(selected.invitees || []).length === 0 ? <li>No invitees stored.</li> : selected.invitees?.map((person) => (
              <li key={`${person.role}-${person.email || person.personId}`}>{person.role}: {person.name || person.personId}{person.email ? ` <${person.email}>` : ""}</li>
            ))}
          </ul>
          <h4 className="mt-4 text-sm font-medium text-[#f0f4f8]">Staff email status</h4>
          <ul className="mt-2 space-y-1 text-sm text-[#8b9bb4]">
            {Object.keys(selected.notifications || {}).length === 0 ? <li>No v2 notification status.</li> : Object.entries(selected.notifications || {}).map(([personId, entry]) => (
              <li key={personId}>{personId} ({entry.role}): {entry.status}</li>
            ))}
          </ul>
          {isLegacyBooking(selected.source) && selected.bookingId ? (
            <button className="mt-4 rounded-lg border border-[#2a3548] px-3 py-2 text-sm text-[#f0f4f8]" type="button" onClick={() => void recoverNote(selected.bookingId || "")}>Read private note</button>
          ) : null}
          {legacyNote ? <p className="mt-3 whitespace-pre-wrap text-sm text-[#f0f4f8]">{legacyNote}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
