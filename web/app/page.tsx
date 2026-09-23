"use client";

import { useMemo, useState } from "react";
import { InstallApp, NetworkStatus } from "./pwa";

type Person = {
  id: number;
  name: string;
  legalName: string;
  role: string;
  staffType: "Paid" | "Volunteer";
  shift: string;
  state: "Signed on" | "On break" | "Planned" | "Did not attend";
  deployment: string;
  equipment: string;
};

const people: Person[] = [
  { id: 1, name: "Alex Morgan", legalName: "Alexandra Morgan", role: "Supervisor", staffType: "Paid", shift: "12:00–20:00", state: "Signed on", deployment: "Welfare tent · Response lead", equipment: "Radio 12 · Earpiece 12 · Black T-shirt M" },
  { id: 2, name: "Jamie Patel", legalName: "Jamie Patel", role: "Responder", staffType: "Paid", shift: "14:00–22:00", state: "On break", deployment: "East gate", equipment: "Radio 08 · Earpiece 08 · Pink T-shirt L" },
  { id: 3, name: "Morgan Ellis", legalName: "Morgan Ellis", role: "Responder", staffType: "Volunteer", shift: "16:00–00:00", state: "Planned", deployment: "Unassigned", equipment: "Pink T-shirt S" },
  { id: 4, name: "Taylor Reed", legalName: "Taylor Reed", role: "Responder", staffType: "Paid", shift: "12:00–20:00", state: "Signed on", deployment: "Main stage · Welfare patrol", equipment: "Radio 17 · Earpiece 17 · Jumper XL" },
  { id: 5, name: "Sam Williams", legalName: "Samuel Williams", role: "Responder", staffType: "Volunteer", shift: "10:00–18:00", state: "Did not attend", deployment: "Unassigned", equipment: "None" },
];

const navigation = ["Dashboard", "Staff", "Operations", "Incidents", "More"];

export default function Home() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [notice, setNotice] = useState("All changes synced");
  const [event, setEvent] = useState("Northstar Festival · Day 2");
  const filtered = useMemo(() => people.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())), [query]);
  const quickAction = (action: string) => setNotice(`${action} opened · synthetic mode`);

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand"><img src="/safer-spaces-logo.webp" alt="Safer Spaces" /><span>Operations</span></div>
      <nav>{navigation.map((item) => <button key={item} className={activeNav === item ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item)}><span className="nav-dot" aria-hidden="true" />{item}</button>)}</nav>
      <InstallApp />
      <div className="privacy-note"><span aria-hidden="true">◉</span><div><strong>Synthetic prototype</strong><small>No live or personal data</small></div></div>
      <div className="account"><span className="avatar">AR</span><div><strong>Alex Rivera</strong><small>Duty manager</small></div><button aria-label="Account menu">•••</button></div>
    </aside>

    <main>
      <header className="topbar"><div><p className="eyebrow">Saturday 15 August · 15:42</p><h1>{activeNav}</h1></div><div className="top-actions"><NetworkStatus /><button className="icon-button" aria-label="Notifications">○</button></div></header>
      <div className="mobile-install"><InstallApp /></div>
      <section className="event-bar" aria-label="Current event"><div><span className="event-mark">N</span><div><small>Current event</small><strong>{event}</strong></div></div><select aria-label="Choose event" value={event} onChange={(e) => setEvent(e.target.value)}><option>Northstar Festival · Day 2</option><option>Harbour Lights · Day 1</option></select></section>
      <section className="hero-row"><div><p className="eyebrow coral">LIVE OPERATIONS</p><h2>Good afternoon, Alex.</h2><p>Here’s what needs attention across today’s shift.</p></div><div className="sync-pill"><span>✓</span><div><strong>{notice}</strong><small>Updated just now</small></div></div></section>

      <section className="metrics" aria-label="Aggregate event summary">
        {[["↗", "Signed on", "24", "+3 in the last hour", "coral-bg"], ["Ⅱ", "On break", "3", "2 due back soon", "amber-bg"], ["⌖", "Deployed", "19", "Across 8 locations", "blue-bg"], ["!", "Kit outstanding", "7", "2 overdue returns", "red-bg"]].map((metric, index) => <article key={metric[1]}><span className={`metric-icon ${metric[4]}`}>{metric[0]}</span><div><small>{metric[1]}</small><strong>{metric[2]}</strong><p className={index === 3 ? "urgent" : ""}>{metric[3]}</p></div></article>)}
      </section>

      <section className="workspace-grid">
        <div className="panel staff-panel">
          <div className="panel-title"><div><h3>Today’s team</h3><p>Planned and active staff for this event</p></div><button className="text-button" onClick={() => setActiveNav("Staff")}>View all →</button></div>
          <label className="search"><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a team member" /></label>
          <div className="staff-list">{filtered.map((person) => <button className="person-row" key={person.id} onClick={() => setSelected(person)}><span className="person-avatar">{person.name.split(" ").map((part) => part[0]).join("")}</span><span className="person-main"><strong>{person.name}</strong><small>{person.role} · {person.staffType} · {person.shift}</small></span><span className={`status ${person.state.toLowerCase().replaceAll(" ", "-")}`}><i />{person.state}</span><span className="chevron">›</span></button>)}</div>
        </div>
        <div className="side-stack">
          <div className="panel actions-panel"><div className="panel-title"><div><h3>Quick actions</h3><p>Common shift tasks</p></div></div><div className="action-grid">{[["↗", "Sign on", "Start a shift"], ["▣", "Issue kit", "Radio, earpiece & clothing"], ["⌖", "Deploy", "Assign one or more tasks"], ["≡", "Radio log", "Add an entry"]].map((action) => <button key={action[1]} onClick={() => quickAction(action[1])}><span>{action[0]}</span><strong>{action[1]}</strong><small>{action[2]}</small></button>)}</div></div>
          <div className="panel attention"><div className="panel-title"><div><h3>Needs attention</h3><p>Items to review</p></div><span className="count">3</span></div><button onClick={() => quickAction("Overdue equipment")}><span className="warn">!</span><div><strong>2 overdue kit returns</strong><small>Expected by 15:30</small></div><span>›</span></button><button onClick={() => quickAction("Unassigned staff")}><span className="neutral">○</span><div><strong>1 person unassigned</strong><small>Shift starts at 16:00</small></div><span>›</span></button></div>
        </div>
      </section>
      <footer><span>Safer Spaces Operations · Synthetic prototype</span><span>Last server check 15:42 · Europe/London</span></footer>
    </main>

    {selected && <div className="modal-backdrop"><section className="drawer" role="dialog" aria-modal="true" aria-labelledby="person-name"><button className="close" aria-label="Close profile" onClick={() => setSelected(null)}>×</button><p className="eyebrow coral">STAFF PROFILE</p><h2 id="person-name">{selected.name}</h2><p>{selected.role} · {selected.staffType} · Today, {selected.shift}</p><dl><div><dt>Legal name</dt><dd>{selected.legalName}</dd></div><div><dt>Attendance</dt><dd>{selected.state}</dd></div><div><dt>Current deployments</dt><dd>{selected.deployment}</dd></div><div><dt>Equipment held</dt><dd>{selected.equipment}</dd></div></dl><button className="primary" onClick={() => { setNotice(`Attendance workflow opened for ${selected.name}`); setSelected(null); }}>Open attendance workflow</button></section></div>}
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.slice(0, 4).map((item) => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}><i />{item}</button>)}</nav>
  </div>;
}
