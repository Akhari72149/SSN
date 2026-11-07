"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type StaffOption = { id: string; name: string; legalName: string; staffType: "Paid" | "Volunteer"; role: string };
type EventOption = { id: string; label: string };
type Shift = { id: string; name: string; startsAt: string; endsAt: string; staffIds: string[] };
type Attendance = { id: string; staffId: string; kind: "sign_on" | "sign_off" | "did_not_attend"; occurredAt: string };
type Deployment = { id: string; staffId: string; label: string; priority: string; startsAt: string; endsAt: string | null };
type Equipment = { id: string; itemCode: string; type: string; colour: string | null; size: string | null; condition: string; allocation: { id: string; staffId: string; issuedAt: string } | null };

type Props = {
  section: string;
  eventId: string;
  events: EventOption[];
  staff: StaffOption[];
  demoMode?: boolean;
  onEventsChanged: () => void;
  onStaffCreated: () => void;
  notify: (message: string) => void;
};

function csrfToken() {
  const part = document.cookie.split("; ").find((cookie) => cookie.startsWith("ssn_csrf="));
  return part ? decodeURIComponent(part.slice("ssn_csrf=".length)) : "";
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.method && options.method !== "GET" ? { "x-csrf-token": csrfToken() } : {}), ...options?.headers },
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed");
  return result;
}

function localInputValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

export default function OperationsManager({ section, eventId, events, staff, demoMode = false, onEventsChanged, onStaffCreated, notify }: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>(demoMode ? [{ id: "demo-shift", name: "Day shift", startsAt: "2026-08-15T11:00:00.000Z", endsAt: "2026-08-15T19:00:00.000Z", staffIds: ["1", "4"] }] : []);
  const [attendance, setAttendance] = useState<Attendance[]>(demoMode ? [{ id: "demo-attendance-1", staffId: "1", kind: "sign_on", occurredAt: "2026-08-15T11:52:00.000Z" }, { id: "demo-attendance-2", staffId: "5", kind: "did_not_attend", occurredAt: "2026-08-15T10:20:00.000Z" }] : []);
  const [deployments, setDeployments] = useState<Deployment[]>(demoMode ? [{ id: "demo-deployment", staffId: "1", label: "Welfare tent · Response lead", priority: "routine", startsAt: "2026-08-15T12:05:00.000Z", endsAt: null }] : []);
  const [equipment, setEquipment] = useState<Equipment[]>(demoMode ? [{ id: "demo-radio", itemCode: "RAD-012", type: "radio", colour: null, size: null, condition: "issued", allocation: { id: "demo-allocation", staffId: "1", issuedAt: "2026-08-15T11:55:00.000Z" } }, { id: "demo-shirt", itemCode: "TS-PINK-M", type: "tshirt", colour: "pink", size: "M", condition: "available", allocation: null }] : []);
  const [defaultTimes] = useState(() => {
    const startsAt = new Date();
    return {
      startsAt: localInputValue(startsAt),
      shiftEndsAt: localInputValue(new Date(startsAt.getTime() + 4 * 3_600_000)),
      eventEndsAt: localInputValue(new Date(startsAt.getTime() + 86_400_000)),
    };
  });

  const refresh = useCallback(async () => {
    if (!eventId || demoMode) return;
    setError("");
    try {
      const [shiftData, attendanceData, deploymentData, equipmentData] = await Promise.all([
        api<{ shifts: Shift[] }>(`/api/events/${eventId}/shifts`),
        api<{ attendance: Attendance[] }>(`/api/events/${eventId}/attendance`),
        api<{ deployments: Deployment[] }>(`/api/events/${eventId}/deployments`),
        api<{ equipment: Equipment[] }>(`/api/events/${eventId}/equipment`),
      ]);
      setShifts(shiftData.shifts);
      setAttendance(attendanceData.attendance);
      setDeployments(deploymentData.deployments);
      setEquipment(equipmentData.equipment);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Operational records could not be loaded"); }
  }, [demoMode, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  async function submitForm(event: FormEvent<HTMLFormElement>, url: string, values: Record<string, unknown>, success: string, after?: () => void) {
    event.preventDefault();
    const form = event.currentTarget;
    if (demoMode) {
      notify(`${success} · demonstration only, nothing was saved`);
      return;
    }
    setBusy(true); setError("");
    try {
      await api(url, { method: "POST", body: JSON.stringify(values) });
      form.reset();
      notify(success);
      after?.();
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The request could not be completed"); }
    finally { setBusy(false); }
  }

  const nameFor = (staffId: string) => staff.find((person) => person.id === staffId)?.name ?? "Unknown staff member";

  if (section === "Incidents") return <section className="management-shell"><div className="management-heading"><div><p className="eyebrow coral">RESTRICTED MODULE</p><h2>Incidents</h2><p>Incident and disclosure records remain disabled until their final retention and access decisions are approved.</p></div></div></section>;

  if (section === "More") return <section className="management-shell"><div className="management-heading"><div><p className="eyebrow coral">ADMINISTRATION</p><h2>Event setup</h2><p>Create the event before adding staff or operational records.</p></div></div><form className="admin-form form-grid" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submitForm(event, "/api/events", { name: data.get("name"), eventCode: data.get("eventCode"), timezone: "Europe/London", startsAt: new Date(String(data.get("startsAt"))).toISOString(), endsAt: new Date(String(data.get("endsAt"))).toISOString() }, "Event created", onEventsChanged); }}><label>Event name<input name="name" required maxLength={160} /></label><label>Event ID code<input name="eventCode" required minLength={2} maxLength={20} pattern="[A-Za-z][A-Za-z0-9]+" placeholder="Btown" /></label><label>Starts<input name="startsAt" type="datetime-local" defaultValue={defaultTimes.startsAt} required /></label><label>Ends<input name="endsAt" type="datetime-local" defaultValue={defaultTimes.eventEndsAt} required /></label><button className="primary compact" disabled={busy}>Create event</button></form>{events.length > 0 && <div className="record-list"><h3>Existing events</h3>{events.map((item) => <div className="record-row" key={item.id}><strong>{item.label}</strong><small>Available to permitted users</small></div>)}</div>}{error && <p className="form-error" role="alert">{error}</p>}</section>;

  if (!eventId) return <section className="management-shell empty-state"><h2>No event selected</h2><p>Create an event under More before adding staff or operations.</p>{error && <p className="form-error" role="alert">{error}</p>}</section>;

  if (section === "Staff") return <section className="management-shell"><div className="management-heading"><div><p className="eyebrow coral">STAFF REGISTER</p><h2>People</h2><p>Preferred names are shown operationally; legal names remain available in the profile.</p></div><span>{staff.length} records</span></div><form className="admin-form form-grid" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submitForm(event, `/api/events/${eventId}/staff`, { legalName: data.get("legalName"), preferredName: data.get("preferredName"), roleLabel: data.get("roleLabel"), staffType: data.get("staffType") }, "Staff record created", onStaffCreated); }}><label>Legal name<input name="legalName" required maxLength={160} /></label><label>Preferred name<input name="preferredName" required maxLength={160} /></label><label>Role<input name="roleLabel" maxLength={120} placeholder="Responder" /></label><label>Staff type<select name="staffType" defaultValue="volunteer"><option value="volunteer">Volunteer</option><option value="paid">Paid</option></select></label><button className="primary compact" disabled={busy}>Add staff member</button></form><div className="record-list">{staff.map((person) => <div className="record-row" key={person.id}><div><strong>{person.name}</strong><small>{person.legalName !== person.name ? `Legal name: ${person.legalName} · ` : ""}{person.role} · {person.staffType}</small></div></div>)}</div>{error && <p className="form-error" role="alert">{error}</p>}</section>;

  return <section className="management-shell"><div className="management-heading"><div><p className="eyebrow coral">CURRENT EVENT</p><h2>Operations</h2><p>Set shifts, record attendance, deploy staff and manage issued kit.</p></div><button className="secondary" onClick={() => void refresh()}>Refresh</button></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-grid">
    <section className="admin-card"><h3>Shift planning</h3><form className="admin-form" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submitForm(event, `/api/events/${eventId}/shifts`, { name: data.get("name"), startsAt: new Date(String(data.get("startsAt"))).toISOString(), endsAt: new Date(String(data.get("endsAt"))).toISOString(), staffIds: data.getAll("staffIds") }, "Shift created"); }}><label>Shift name<input name="name" required placeholder="Day shift" /></label><div className="form-pair"><label>Starts<input name="startsAt" type="datetime-local" defaultValue={defaultTimes.startsAt} required /></label><label>Ends<input name="endsAt" type="datetime-local" defaultValue={defaultTimes.shiftEndsAt} required /></label></div><label>Assigned staff<select name="staffIds" multiple size={Math.min(5, Math.max(2, staff.length))}>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><button className="primary compact" disabled={busy}>Create shift</button></form><div className="mini-list">{shifts.map((shift) => <div key={shift.id}><strong>{shift.name}</strong><small>{new Date(shift.startsAt).toLocaleString("en-GB")} · {shift.staffIds.length} assigned</small></div>)}</div></section>
    <section className="admin-card"><h3>Attendance</h3><form className="admin-form" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submitForm(event, `/api/events/${eventId}/attendance`, { staffId: data.get("staffId"), kind: data.get("kind"), occurredAt: new Date().toISOString() }, "Attendance recorded", onStaffCreated); }}><label>Staff member<select name="staffId" required><option value="">Choose staff</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Action<select name="kind" defaultValue="sign_on"><option value="sign_on">Sign on</option><option value="sign_off">Sign off</option><option value="did_not_attend">Did not attend</option></select></label><button className="primary compact" disabled={busy}>Record attendance</button></form><div className="mini-list">{attendance.slice(0, 8).map((item) => <div key={item.id}><strong>{nameFor(item.staffId)}</strong><small>{item.kind.replaceAll("_", " ")} · {new Date(item.occurredAt).toLocaleString("en-GB")}</small></div>)}</div></section>
    <section className="admin-card"><h3>Deployments</h3><form className="admin-form" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submitForm(event, `/api/events/${eventId}/deployments`, { action: "start", staffId: data.get("staffId"), label: data.get("label"), priority: data.get("priority") }, "Deployment started", onStaffCreated); }}><label>Staff member<select name="staffId" required><option value="">Choose staff</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Location or task<input name="label" required maxLength={160} placeholder="East gate" /></label><label>Priority<select name="priority"><option value="routine">Routine</option><option value="priority">Priority</option><option value="urgent">Urgent</option></select></label><button className="primary compact" disabled={busy}>Deploy</button></form><div className="mini-list">{deployments.filter((item) => !item.endsAt).map((item) => <div key={item.id}><span><strong>{item.label}</strong><small>{nameFor(item.staffId)} · {item.priority}</small></span><button className="text-button" onClick={() => void api(`/api/events/${eventId}/deployments`, { method: "POST", body: JSON.stringify({ action: "complete", deploymentId: item.id }) }).then(() => { notify("Deployment completed"); void refresh(); }).catch((cause) => setError(cause.message))}>Complete</button></div>)}</div></section>
    <section className="admin-card equipment-card"><h3>Equipment</h3><div className="split-forms"><form className="admin-form" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submitForm(event, `/api/events/${eventId}/equipment`, { action: "create", itemCode: data.get("itemCode"), type: data.get("type"), colour: data.get("colour") || null, size: data.get("size") || null }, "Equipment added"); }}><h4>Add inventory</h4><label>Item code<input name="itemCode" required placeholder="RAD-001" /></label><label>Type<select name="type"><option value="radio">Radio</option><option value="earpiece">Earpiece</option><option value="tshirt">T-shirt</option><option value="jumper">Jumper</option><option value="tracker">Tracker</option><option value="other">Other</option></select></label><div className="form-pair"><label>Colour<select name="colour"><option value="">N/A</option><option value="black">Black</option><option value="pink">Pink</option><option value="other">Other</option></select></label><label>Size<select name="size"><option value="">N/A</option>{["S", "M", "L", "XL", "XXL"].map((size) => <option key={size}>{size}</option>)}</select></label></div><button className="primary compact" disabled={busy}>Add item</button></form><form className="admin-form" onSubmit={(event) => { const data = new FormData(event.currentTarget); void submitForm(event, `/api/events/${eventId}/equipment`, { action: "issue", equipmentItemId: data.get("equipmentItemId"), staffId: data.get("staffId") }, "Equipment issued", onStaffCreated); }}><h4>Issue available item</h4><label>Equipment<select name="equipmentItemId" required><option value="">Choose item</option>{equipment.filter((item) => item.condition === "available").map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.type}</option>)}</select></label><label>Staff member<select name="staffId" required><option value="">Choose staff</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><button className="primary compact" disabled={busy}>Issue item</button></form></div><div className="mini-list">{equipment.map((item) => <div key={item.id}><span><strong>{item.itemCode} · {item.type}{item.colour ? ` · ${item.colour}` : ""}{item.size ? ` · ${item.size}` : ""}</strong><small>{item.allocation ? `Issued to ${nameFor(item.allocation.staffId)}` : item.condition}</small></span>{item.allocation && <button className="text-button" onClick={() => void api(`/api/events/${eventId}/equipment`, { method: "POST", body: JSON.stringify({ action: "return", allocationId: item.allocation?.id, condition: "available" }) }).then(() => { notify("Equipment returned"); void refresh(); }).catch((cause) => setError(cause.message))}>Return</button>}</div>)}</div></section>
  </div></section>;
}
