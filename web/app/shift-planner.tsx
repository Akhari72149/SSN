"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type StaffOption = { id: string; name: string };
type Position = { id: string; name: string };
type EventInfo = { id: string; name: string; startsAt: string; endsAt: string };
type Shift = {
  id: string;
  positionId: string | null;
  positionName: string;
  name: string;
  startsAt: string;
  endsAt: string;
  assignments: Array<{ id: string; staffId: string; staffName: string }>;
};
type ViewMode = "day" | "event" | "custom" | "person";

function csrfToken() {
  const part = document.cookie.split("; ").find((cookie) => cookie.startsWith("ssn_csrf="));
  return part ? decodeURIComponent(part.slice("ssn_csrf=".length)) : "";
}

function localDateValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 10);
}

function localDateTimeValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function startOfLocalDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

const demoEvent: EventInfo = { id: "northstar", name: "Northstar Festival", startsAt: "2026-08-15T00:00:00.000Z", endsAt: "2026-08-18T00:00:00.000Z" };
const demoPositions: Position[] = [{ id: "welfare", name: "Welfare Tent" }, { id: "east-gate", name: "East Gate" }, { id: "patrol", name: "Welfare Patrol" }];
const demoShifts: Shift[] = [
  { id: "shift-1", positionId: "welfare", positionName: "Welfare Tent", name: "Day", startsAt: "2026-08-15T08:00:00.000Z", endsAt: "2026-08-15T16:00:00.000Z", assignments: [{ id: "a1", staffId: "1", staffName: "Alex Morgan" }] },
  { id: "shift-2", positionId: "east-gate", positionName: "East Gate", name: "Evening", startsAt: "2026-08-15T14:00:00.000Z", endsAt: "2026-08-15T22:00:00.000Z", assignments: [{ id: "a2", staffId: "2", staffName: "Jamie Patel" }] },
];

export default function ShiftPlanner({ eventId, staff, demoMode = false, notify }: { eventId: string; staff: StaffOption[]; demoMode?: boolean; notify: (message: string) => void }) {
  const [positions, setPositions] = useState<Position[]>(demoMode ? demoPositions : []);
  const [shifts, setShifts] = useState<Shift[]>(demoMode ? demoShifts : []);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(demoMode ? demoEvent : null);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [day, setDay] = useState(localDateValue);
  const [customStart, setCustomStart] = useState(localDateValue);
  const [customEnd, setCustomEnd] = useState(localDateValue);
  const [personSearch, setPersonSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [defaultShiftTimes] = useState(() => {
    const startsAt = new Date();
    return { startsAt: localDateTimeValue(startsAt), endsAt: localDateTimeValue(new Date(startsAt.getTime() + 4 * 3_600_000)) };
  });

  const requestedRange = useMemo(() => {
    if (viewMode === "event" || viewMode === "person") return null;
    if (viewMode === "day") {
      const from = startOfLocalDay(day);
      return { from, to: new Date(from.getTime() + 86_400_000) };
    }
    const from = startOfLocalDay(customStart);
    const to = new Date(startOfLocalDay(customEnd).getTime() + 86_400_000);
    return { from, to };
  }, [customEnd, customStart, day, viewMode]);

  const load = useCallback(async () => {
    if (!eventId) return;
    if (demoMode) {
      setEventInfo(demoEvent); setPositions(demoPositions);
      setShifts(demoShifts.filter((shift) => viewMode !== "person" || !personSearch || shift.assignments.some((assignment) => assignment.staffName.toLowerCase().includes(personSearch.toLowerCase()))));
      return;
    }
    setError("");
    const query = new URLSearchParams();
    if (requestedRange) { query.set("from", requestedRange.from.toISOString()); query.set("to", requestedRange.to.toISOString()); }
    if (viewMode === "person" && personSearch.trim()) query.set("person", personSearch.trim());
    try {
      const response = await fetch(`/api/events/${eventId}/shifts?${query}`);
      const result = await response.json() as { error?: string; event?: EventInfo; positions?: Position[]; shifts?: Shift[] };
      if (!response.ok || !result.event) throw new Error(result.error ?? "Shifts could not be loaded");
      setEventInfo(result.event); setPositions(result.positions ?? []); setShifts(result.shifts ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Shifts could not be loaded"); }
  }, [demoMode, eventId, personSearch, requestedRange, viewMode]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), viewMode === "person" ? 250 : 0); return () => window.clearTimeout(timer); }, [load, viewMode]);

  async function submit(event: FormEvent<HTMLFormElement>, values: Record<string, unknown>, success: string) {
    event.preventDefault();
    const form = event.currentTarget;
    if (demoMode) { notify(`${success} · demonstration only, nothing was saved`); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/shifts`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify(values) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The scheduling change could not be saved");
      form.reset(); notify(success); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The scheduling change could not be saved"); }
    finally { setBusy(false); }
  }

  if (!eventId) return <section className="management-shell empty-state"><h2>No event selected</h2><p>Create or select an event before planning shifts.</p></section>;

  const fallbackStart = eventInfo ? new Date(eventInfo.startsAt) : new Date();
  const fallbackEnd = eventInfo ? new Date(eventInfo.endsAt) : new Date(fallbackStart.getTime() + 86_400_000);
  const rangeStart = requestedRange?.from ?? fallbackStart;
  const rangeEnd = requestedRange?.to ?? fallbackEnd;
  const rangeMs = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());
  const timelinePositions = [...positions];
  if (shifts.some((shift) => !shift.positionId)) timelinePositions.push({ id: "unpositioned", name: "Unpositioned" });
  const ticks = Array.from({ length: 7 }, (_, index) => new Date(rangeStart.getTime() + (rangeMs * index) / 6));
  const longRange = rangeMs > 36 * 3_600_000;

  return <section className="management-shell shift-planner"><div className="management-heading"><div><p className="eyebrow coral">SHIFT PLANNING</p><h2>Gantt schedule</h2><p>Create positions, schedule coverage and assign people across the event.</p></div><button className="secondary" onClick={() => void load()}>Refresh</button></div>
    <div className="schedule-forms"><section className="admin-card"><h3>Create position</h3><form className="admin-form" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submit(event, { action: "create_position", name: data.get("name") }, "Position created"); }}><label>Position name<input name="name" required maxLength={120} placeholder="Welfare Tent" /></label><button className="primary compact" disabled={busy}>Create position</button></form></section><section className="admin-card"><h3>Create and assign shift</h3><form className="admin-form" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submit(event, { action: "create_shift", positionId: data.get("positionId"), name: data.get("name"), startsAt: new Date(String(data.get("startsAt"))).toISOString(), endsAt: new Date(String(data.get("endsAt"))).toISOString(), staffIds: data.getAll("staffIds") }, "Shift created"); }}><label>Position<select name="positionId" required defaultValue=""><option value="" disabled>Choose position</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label><label>Shift label<input name="name" required maxLength={120} placeholder="Day shift" /></label><div className="form-pair"><label>Starts<input name="startsAt" type="datetime-local" defaultValue={defaultShiftTimes.startsAt} required /></label><label>Ends<input name="endsAt" type="datetime-local" defaultValue={defaultShiftTimes.endsAt} required /></label></div><label>Assigned people<select name="staffIds" multiple size={Math.min(6, Math.max(3, staff.length))}>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><small>Hold Ctrl, or Command on iPhone/iPad with a keyboard, to select multiple people.</small></label><button className="primary compact" disabled={busy || positions.length === 0}>Create shift</button></form></section></div>
    <section className="gantt-panel"><div className="gantt-toolbar"><label>View<select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}><option value="day">One day</option><option value="event">Entire event</option><option value="custom">Date range</option><option value="person">Search person</option></select></label>{viewMode === "day" && <label>Date<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>}{viewMode === "custom" && <><label>From<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>To<input type="date" min={customStart} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}{viewMode === "person" && <label className="person-shift-search">Staff name<input type="search" value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder="Start typing a name" /></label>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="gantt-scroll"><div className="gantt-chart"><div className="gantt-times"><span>Position</span><div>{ticks.map((tick) => <small key={tick.toISOString()} style={{ left: `${((tick.getTime() - rangeStart.getTime()) / rangeMs) * 100}%` }}>{tick.toLocaleString("en-GB", longRange ? { day: "2-digit", month: "short" } : { hour: "2-digit", minute: "2-digit" })}</small>)}</div></div>{timelinePositions.map((position) => { const rows = shifts.filter((shift) => shift.positionId === position.id || (position.id === "unpositioned" && !shift.positionId)); return <div className="gantt-row" key={position.id}><strong>{position.name}</strong><div className="gantt-track">{rows.map((shift) => { const visibleStart = Math.max(new Date(shift.startsAt).getTime(), rangeStart.getTime()); const visibleEnd = Math.min(new Date(shift.endsAt).getTime(), rangeEnd.getTime()); if (visibleEnd <= visibleStart) return null; const left = ((visibleStart - rangeStart.getTime()) / rangeMs) * 100; const width = Math.max(1.5, ((visibleEnd - visibleStart) / rangeMs) * 100); return <article className="gantt-shift" key={shift.id} style={{ left: `${left}%`, width: `${width}%` }} title={`${shift.name}: ${new Date(shift.startsAt).toLocaleString("en-GB")} – ${new Date(shift.endsAt).toLocaleString("en-GB")}`}><b>{shift.name}</b><span>{shift.assignments.map((assignment) => assignment.staffName).join(", ") || "Unassigned"}</span></article>; })}</div></div>; })}{timelinePositions.length === 0 && <div className="gantt-empty">Create a position to begin planning shifts.</div>}</div></div>
    </section>
  </section>;
}
