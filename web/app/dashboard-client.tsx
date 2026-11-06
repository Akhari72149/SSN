"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { InstallApp, NetworkStatus } from "./pwa";
import LogoutButton from "./logout-button";
import OperationsManager from "./operations-manager";

type Person = {
  id: string;
  name: string;
  legalName: string;
  role: string;
  staffType: "Paid" | "Volunteer";
  shift: string;
  state: "Signed on" | "On break" | "Planned" | "Did not attend";
  deployment: string;
  equipment: string;
};

const syntheticPeople: Person[] = [
  { id: "1", name: "Alex Morgan", legalName: "Alexandra Morgan", role: "Supervisor", staffType: "Paid", shift: "12:00–20:00", state: "Signed on", deployment: "Welfare tent · Response lead", equipment: "Radio 12 · Earpiece 12 · Black T-shirt M" },
  { id: "2", name: "Jamie Patel", legalName: "Jamie Patel", role: "Responder", staffType: "Paid", shift: "14:00–22:00", state: "On break", deployment: "East gate", equipment: "Radio 08 · Earpiece 08 · Pink T-shirt L" },
  { id: "3", name: "Morgan Ellis", legalName: "Morgan Ellis", role: "Responder", staffType: "Volunteer", shift: "16:00–00:00", state: "Planned", deployment: "Unassigned", equipment: "Pink T-shirt S" },
  { id: "4", name: "Taylor Reed", legalName: "Taylor Reed", role: "Responder", staffType: "Paid", shift: "12:00–20:00", state: "Signed on", deployment: "Main stage · Welfare patrol", equipment: "Radio 17 · Earpiece 17 · Jumper XL" },
  { id: "5", name: "Sam Williams", legalName: "Samuel Williams", role: "Responder", staffType: "Volunteer", shift: "10:00–18:00", state: "Did not attend", deployment: "Unassigned", equipment: "None" },
];

type EventOption = { id: string; label: string };

const navigation = ["Dashboard", "Staff", "Operations", "Incidents", "More"];

type DashboardClientProps = {
  viewerName?: string;
  viewerRole?: string;
  synthetic?: boolean;
};

export default function DashboardClient({
  viewerName = "Alex Rivera",
  viewerRole = "Duty manager",
  synthetic = true,
}: DashboardClientProps) {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [notice, setNotice] = useState("All changes synced");
  const [team, setTeam] = useState<Person[]>(synthetic ? syntheticPeople : []);
  const [eventOptions, setEventOptions] = useState<EventOption[]>(synthetic ? [
    { id: "northstar", label: "Northstar Festival · Day 2" },
    { id: "harbour", label: "Harbour Lights · Day 1" },
  ] : []);
  const [event, setEvent] = useState(synthetic ? "northstar" : "");
  const viewerFirstName = viewerName.split(" ")[0] || viewerName;
  const viewerInitials = viewerName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const filtered = useMemo(() => team.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())), [query, team]);
  const eventLabel = eventOptions.find((option) => option.id === event)?.label ?? "No active event";
  const signedOn = team.filter((person) => person.state === "Signed on").length;
  const onBreak = team.filter((person) => person.state === "On break").length;
  const deployed = team.filter((person) => person.deployment !== "Unassigned").length;
  const kitOutstanding = team.filter((person) => person.equipment !== "None").length;
  const unassigned = team.filter((person) => person.deployment === "Unassigned").length;
  const quickAction = (action: string) => {
    setNotice(synthetic ? `${action} opened · demonstration only` : `${action} workflow ready`);
    setActiveNav("Operations");
  };

  const loadEvents = useCallback(async () => {
    if (synthetic) return;
    try {
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Events could not be loaded");
      const result = await response.json() as { events: Array<{ id: string; name: string }> };
      const options = result.events.map((item) => ({ id: item.id, label: item.name }));
      setEventOptions(options);
      setEvent((current) => options.some((option) => option.id === current) ? current : options[0]?.id ?? "");
      setNotice(options.length ? "Live events loaded securely" : "No events have been created yet");
    } catch { setNotice("Events are unavailable or not permitted"); }
  }, [synthetic]);

  const loadStaff = useCallback(async () => {
    if (synthetic || !event) return;
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event)}/staff`);
      if (!response.ok) throw new Error("Staff could not be loaded");
      const result = await response.json() as { staff: Array<{ id: string; legalName: string; preferredName: string; staffType: "paid" | "volunteer"; roleLabel: string | null; attendanceState: "sign_on" | "sign_off" | "did_not_attend" | null; deploymentLabels: string[]; equipmentLabels: string[]; shift: { name: string; startsAt: string; endsAt: string } | null }> };
      setTeam(result.staff.map((person) => ({
        id: person.id,
        name: person.preferredName,
        legalName: person.legalName,
        role: person.roleLabel ?? "Staff",
        staffType: person.staffType === "paid" ? "Paid" : "Volunteer",
        shift: person.shift ? `${new Date(person.shift.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–${new Date(person.shift.endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Not scheduled",
        state: person.attendanceState === "sign_on" ? "Signed on" : person.attendanceState === "did_not_attend" ? "Did not attend" : "Planned",
        deployment: person.deploymentLabels.length ? person.deploymentLabels.join(" · ") : "Unassigned",
        equipment: person.equipmentLabels.length ? person.equipmentLabels.join(" · ") : "None",
      })));
    } catch { setTeam([]); setNotice("Staff records are unavailable or not permitted"); }
  }, [event, synthetic]);

  useEffect(() => { const timer = window.setTimeout(() => void loadEvents(), 0); return () => window.clearTimeout(timer); }, [loadEvents]);
  useEffect(() => { const timer = window.setTimeout(() => void loadStaff(), 0); return () => window.clearTimeout(timer); }, [loadStaff]);

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand"><Image src="/safer-spaces-logo.webp" alt="Safer Spaces" width={168} height={51} priority /><span>Operations</span></div>
      <nav>{navigation.map((item) => <button key={item} className={activeNav === item ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item)}><span className="nav-dot" aria-hidden="true" />{item}</button>)}</nav>
      <InstallApp />
      <div className="privacy-note"><span aria-hidden="true">◉</span><div><strong>{synthetic ? "Synthetic prototype" : "Secure live mode"}</strong><small>{synthetic ? "No live or personal data" : "Account permissions enforced"}</small></div></div>
      <div className="account"><span className="avatar">{viewerInitials}</span><div><strong>{viewerName}</strong><small>{viewerRole}</small></div>{synthetic ? <button aria-label="Account menu">•••</button> : <LogoutButton />}</div>
    </aside>

    <main>
      <header className="topbar"><div><p className="eyebrow">{synthetic ? "Saturday 15 August · 15:42" : "Europe/London · Current event"}</p><h1>{activeNav}</h1></div><div className="top-actions"><NetworkStatus /><button className="icon-button" aria-label="Notifications">○</button></div></header>
      <div className="mobile-install"><InstallApp /></div>
      <section className="event-bar" aria-label="Current event"><div><span className="event-mark">N</span><div><small>Current event</small><strong>{eventLabel}</strong></div></div><select aria-label="Choose event" value={event} onChange={(e) => setEvent(e.target.value)} disabled={eventOptions.length === 0}>{eventOptions.length === 0 ? <option value="">No events</option> : eventOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></section>
      {activeNav === "Dashboard" && <><section className="hero-row"><div><p className="eyebrow coral">LIVE OPERATIONS</p><h2>Good afternoon, {viewerFirstName}.</h2><p>Here’s what needs attention across today’s shift.</p></div><div className="sync-pill"><span>✓</span><div><strong>{notice}</strong><small>Updated just now</small></div></div></section>

      <section className="metrics" aria-label="Aggregate event summary">
        {[["↗", "Signed on", String(synthetic ? 24 : signedOn), synthetic ? "+3 in the last hour" : "Current event", "coral-bg"], ["Ⅱ", "On break", String(synthetic ? 3 : onBreak), synthetic ? "2 due back soon" : "Current event", "amber-bg"], ["⌖", "Deployed", String(synthetic ? 19 : deployed), synthetic ? "Across 8 locations" : "Active assignments", "blue-bg"], ["!", "Kit outstanding", String(synthetic ? 7 : kitOutstanding), synthetic ? "2 overdue returns" : "Currently issued", "red-bg"]].map((metric, index) => <article key={metric[1]}><span className={`metric-icon ${metric[4]}`}>{metric[0]}</span><div><small>{metric[1]}</small><strong>{metric[2]}</strong><p className={index === 3 ? "urgent" : ""}>{metric[3]}</p></div></article>)}
      </section></>}
      {activeNav !== "Dashboard" && synthetic && <p className="demo-banner">Demonstration preview · explore every section safely; changes are not saved</p>}
      {activeNav !== "Dashboard" && <OperationsManager section={activeNav} eventId={event} events={eventOptions} staff={team} demoMode={synthetic} onEventsChanged={() => void loadEvents()} onStaffCreated={() => void loadStaff()} notify={setNotice} />}

      {activeNav === "Dashboard" && <section className="workspace-grid">
        <div className="panel staff-panel">
          <div className="panel-title"><div><h3>Today’s team</h3><p>Planned and active staff for this event</p></div><button className="text-button" onClick={() => setActiveNav("Staff")}>View all →</button></div>
          <label className="search"><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a team member" /></label>
          <div className="staff-list">{filtered.map((person) => <button className="person-row" key={person.id} onClick={() => setSelected(person)}><span className="person-avatar">{person.name.split(" ").map((part) => part[0]).join("")}</span><span className="person-main"><strong>{person.name}</strong><small>{person.role} · {person.staffType} · {person.shift}</small></span><span className={`status ${person.state.toLowerCase().replaceAll(" ", "-")}`}><i />{person.state}</span><span className="chevron">›</span></button>)}</div>
        </div>
        <div className="side-stack">
          <div className="panel actions-panel"><div className="panel-title"><div><h3>Quick actions</h3><p>Common shift tasks</p></div></div><div className="action-grid">{[["↗", "Sign on", "Start a shift"], ["▣", "Issue kit", "Radio, earpiece & clothing"], ["⌖", "Deploy", "Assign one or more tasks"], ["≡", "Radio log", "Add an entry"]].map((action) => <button key={action[1]} onClick={() => quickAction(action[1])}><span>{action[0]}</span><strong>{action[1]}</strong><small>{action[2]}</small></button>)}</div></div>
          <div className="panel attention"><div className="panel-title"><div><h3>Needs attention</h3><p>Items to review</p></div><span className="count">{synthetic ? 3 : unassigned}</span></div>{synthetic && <button onClick={() => quickAction("Overdue equipment")}><span className="warn">!</span><div><strong>2 overdue kit returns</strong><small>Expected by 15:30</small></div><span>›</span></button>}<button onClick={() => quickAction("Unassigned staff")}><span className="neutral">○</span><div><strong>{synthetic ? "1 person unassigned" : `${unassigned} ${unassigned === 1 ? "person" : "people"} unassigned`}</strong><small>{synthetic ? "Shift starts at 16:00" : "Current event records"}</small></div><span>›</span></button></div>
        </div>
      </section>}
      <footer><span>Safer Spaces Operations · {synthetic ? "Synthetic prototype" : "Secure live mode"}</span><span>Last server check 15:42 · Europe/London</span></footer>
    </main>

    {selected && <div className="modal-backdrop"><section className="drawer" role="dialog" aria-modal="true" aria-labelledby="person-name"><button className="close" aria-label="Close profile" onClick={() => setSelected(null)}>×</button><p className="eyebrow coral">STAFF PROFILE</p><h2 id="person-name">{selected.name}</h2><p>{selected.role} · {selected.staffType} · Today, {selected.shift}</p><dl><div><dt>Legal name</dt><dd>{selected.legalName}</dd></div><div><dt>Attendance</dt><dd>{selected.state}</dd></div><div><dt>Current deployments</dt><dd>{selected.deployment}</dd></div><div><dt>Equipment held</dt><dd>{selected.equipment}</dd></div></dl><button className="primary" onClick={() => { setNotice(`Attendance workflow opened for ${selected.name}`); setSelected(null); }}>Open attendance workflow</button></section></div>}
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><i />{item}</button>)}</nav>
  </div>;
}
