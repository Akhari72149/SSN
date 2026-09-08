# Application Screen Map and Core Journeys

Status: pre-build specification. All prototypes use synthetic data.

## Navigation model

Desktop uses a persistent left navigation; mobile uses a bottom bar for the four most frequent destinations plus a `More` menu. Navigation items are permission-filtered, but the server remains authoritative.

Primary destinations: Dashboard, Staff, Operations, Incidents, and More. `Operations` contains attendance, breaks, equipment, and deployment. `More` contains events, radio log, reports, offline/sync, lists/setup, users/access, audit, and system status according to permissions.

## Screen inventory

| Area | Screen | Purpose |
|---|---|---|
| Authentication | Sign in | Email/username and password or future passkey |
| Authentication | MFA challenge/enrolment | TOTP/passkey setup, challenge and recovery-code acknowledgement |
| Authentication | Recovery | User recovery request and authorised administrative recovery |
| Context | Event selector | Choose active event; directors may use organisation-wide overview |
| Dashboard | Aggregate dashboard | Numbers only: planned, signed on, on break, deployments, outstanding equipment, permitted incident counts |
| Staff | Staff list/search | Search the authorised staff register; clear offline-state indicator |
| Staff | Staff profile | Identity, event shifts, attendance state, deployment and outstanding equipment |
| Staff | Add/edit/import | Maintain roster and validate synthetic/PDF-derived imports |
| Attendance | Shift plan | Event dates, planned shifts, overnight shifts, reassignment/cancellation |
| Attendance | Sign on | Select staff, confirm event/shift, optionally issue equipment |
| Attendance | Break | Start/end break and show current availability |
| Attendance | Sign off | Return outstanding items, record time and exceptions |
| Attendance | Exceptions/corrections | Review flags and correct with original value, reason and audit |
| Equipment | Current custody | Outstanding kit, radios, earpieces and trackers |
| Equipment | Issue/return/update | Quantity/size or numbered asset operations and condition |
| Equipment | Asset/setup | Numbered radios/trackers and controlled equipment lists |
| Deployment | Live deployment board | Signed-on people, current task and minimal operational note |
| Deployment | Change history | Who changed task, from/to and times |
| Radio log | Chronological log | Informal on-shift coordination entries, separate from formal incidents |
| Incidents | General incident list | General incidents only, plus restricted incidents only for authorised accounts |
| Incidents | Incident form | Create/edit structured incident record with classification and status |
| Incidents | Incident detail/history | Current record, immutable revisions, contacts/actions and export controls |
| Incidents | Restrict/unrestrict | Dedicated privileged action with re-authentication, reason and audit |
| Incidents | Preservation hold | Apply/release police/legal/safeguarding hold with separate permission |
| Incidents | Purge confirmation | Dedicated irreversible confirmation page specified in `requirements.md` |
| Reports | Aggregate reports | Permission-filtered counts; restricted cases omitted for unauthorised users |
| Reports | Incident export | Individual/bulk exports, purpose, re-authentication and expiry |
| Offline | Sync centre | Connection, local records, queue, conflicts, expiry and retry |
| Administration | Users and access | Accounts, capability templates, per-person overrides and revocation |
| Administration | Lists/setup | Statuses, kit, sizes, conditions, locations, tasks and tracker notes |
| Administration | Audit | Security/operational actions according to audit permissions |
| Administration | Event lifecycle | Create, open, close, archive and retention status without global reset |
| System | Not found/denied | Non-disclosing responses, including restricted-incident direct links |
| System | Service unavailable | Safe fallback instructions and queued-operation status |

## Priority journeys

### Start a shift

Select event → search/select staff → confirm planned shift → sign on → optionally issue equipment → server acceptance or visible offline queue → dashboard/deployment update.

### Break and sign off

Open staff/profile or quick action → start/end break → sign off → review outstanding equipment → record returns/exceptions → confirm → attendance becomes off shift.

### Create an incident

Incidents → create → select General or Restricted only if permitted → complete structured fields → save draft/submit → audit revision → selectively enable offline availability if permitted.

### Restrict an incident

Incident detail → Restrict (permission required) → re-authenticate → reason → confirm. It disappears immediately from unauthorised online views and is removed from their devices at next sync.

### Full purge

Incident detail → Full purge (permission required) → dedicated confirmation page → hold check → re-authenticate → reason → type case reference → irreversible checkbox → final purge → content-free completion record.

## UX rules

- Every mutation shows `Saved`, `Saved on this device`, `Syncing`, `Conflict`, `Rejected`, or `Expired`; never use ambiguous success.
- High-frequency tasks require no more than a few clear steps and retain accessible manual input alongside scanning.
- Restricted incidents have no placeholder, count, suggestion or search trace for unauthorised accounts.
- Browser/page titles and notifications contain no person or incident details.
- Apply `design-system.md` across phone, tablet and desktop layouts.

