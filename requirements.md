# Safer Spaces Operations App — Requirements Map

Status: discovery baseline updated 15 August 2026 after sponsor answers and authorised, read-only inspection of the Google Sheet structure. Row-level contents were not copied into this repository.

## Executive findings

1. Build an operational coordination system, not a general staff-record or welfare case-management system.
2. Keep identity, shift attendance, asset custody, deployment, and incident/radio records as separate domains with separate permissions and retention rules.
3. Do not reproduce the spreadsheet as one large editable grid. Use short task-based flows, immutable event records for custody/attendance changes, and derived current-state views.
4. A PWA may improve resilience, but sensitive operational data must not be broadly cached on devices. Offline capability should be deliberately narrow and risk-assessed.
5. Prototype only with synthetic people, events, assets, and notes until the data owner authorises a controlled migration.
6. Events/festivals are first-class security and data boundaries: several events may run simultaneously and each keeps separate shifts, attendance, assets, deployments, dashboards, and closure/archive state.
7. Permissions must be assignable per person. Named roles may provide templates, but effective access is a set of explicit capabilities and event scopes.
8. Reliable offline capture is confirmed as essential. The prototype must validate a deliberately limited, encrypted event queue and conflict handling before broader offline scope is accepted.

## Requirement status vocabulary

- **Confirmed**: explicitly present in the sponsor’s workflow description.
- **Working assumption**: useful for architecture, but must be validated before implementation.
- **Question**: material ambiguity; see `open-questions.md`.

## Confirmed functional requirements

| Domain | Required capability | Important constraint |
|---|---|---|
| Staff register | Find and view staff needed for operations | The minimum fields and source of truth are not yet known |
| Shift planning | Create and view shift plans and assigned staff | Rules for clashes, cancellations, and late changes are unknown |
| Attendance | Sign staff on and off; calculate timing flags | Manual correction must not erase original events |
| Equipment custody | Issue and return kit, radios, earpieces, and trackers | Custody history must remain attributable and auditable |
| Equipment updates | Record changes while a shift is active | Need clear lost/damaged/swapped workflows |
| Deployment | Record current deployments/tasks and operational notes | Visibility and sensitivity vary by content |
| Lookup | Quickly find a staff member and current operational status | Search results must follow least privilege |
| Dashboards | Show actionable operational summaries | Avoid exposing sensitive details on shared screens |
| Archive/reset | Close an operational period and prepare the next | “Reset” must never mean destructive bulk deletion without controls |
| Lists/setup | Manage controlled values and operational configuration | Changes require privileged roles and audit history |
| Incident/radio log | Support incident and radio-log concepts | Scope, evidential status, fields, and retention are unconfirmed |

## Confirmed operating decisions

- Users initially include directors, deputy heads, managers, and supervisors. The organisation also works with paid staff and volunteers, but it is not yet confirmed which of them receive application accounts.
- Devices are a mix of personal and organisation-owned phones, tablets, and laptops.
- Dashboard displays are aggregate numbers only; personal or case details must not appear.
- Staff lookup may search the full staff directory, subject to the user having the specific lookup capability.
- Sign-on/off does not currently require identity checking at the desk.
- Shifts have set times, may cross midnight, and need break states such as `On break` and `Break completed`.
- Trackers are festival-provided equipment allocations, not continuous location tracking. They are not used at every event.
- Radios, earpieces, and trackers are independently assigned. Radios have numbered identifiers; most kit is quantity/size based rather than individually serialised.
- Attendance timing flags are operational but may affect paid staff. They must be reviewable, correctable, and not treated as an automatic payroll or disciplinary decision.
- The operational radio log is a separate, informal on-shift log. Formal incident/evidence reporting will be a later form/module requiring separate discovery.
- Incident exports are expected both individually and in bulk; dashboard/reporting also needs aggregate case counts.
- Notifications may later be enabled selectively and must reveal minimal locked-screen content, e.g. `New SA case`, with no person or case detail.
- Anna MacGregor is the currently named accountable director; deputies and the allocation of privacy, security, service, operational, and safeguarding responsibilities remain to be documented.
- Login accounts are limited to directors, managers, supervisors, and administrators. Other staff and volunteers appear in the roster without application accounts.
- Authorised users operate organisation-wide rather than being restricted to a single festival. Individual capabilities still limit functions and case-detail access.
- No existing workforce identity provider is available. Hosting is a Contabo VPS running Windows Server 2016.

## Required cross-cutting behaviours

- Responsive mobile and desktop interface; keyboard-operable and designed toward WCAG 2.2 AA.
- Fast “today/active shift” home view with large targets, plain language, and minimal typing.
- Server-authoritative timestamps, actor identity, and append-only history for material events.
- Explicit correction workflows: original value, corrected value, reason, actor, and timestamp.
- Clear states for people, shifts, assets, deployments, and incidents; prevent impossible transitions.
- Stable unique IDs independent of names, row numbers, call signs, or asset labels.
- Every operational record is linked to exactly one event/festival; cross-event views require an explicit capability.
- Offline actions expose clear `saved on device`, `syncing`, `synced`, `conflict`, and `expired/rejected` states.
- Persist all instants in UTC. Display and interpret event-local times using the IANA timezone `Europe/London`, which automatically changes between GMT and BST. Never use a fixed `UTC+0`/`UTC+1` offset. The VPS timezone (`Europe/Berlin`) must not affect stored timestamps, shift calculations, exports, flags, or scheduled jobs.
- Store each event’s timezone explicitly, defaulting to `Europe/London`, so the rule is visible and testable rather than inherited from the server.
- Preserve the entered local time, resolved UTC instant, timezone ID, and offset where an operational/audit record must explain DST handling. Ambiguous or nonexistent clock times at DST transitions require user confirmation.
- Safe concurrent editing with optimistic concurrency/version checks and friendly conflict handling.
- Export only for authorised, defined purposes; every export logged and protected.
- Accessibility, performance, security, recovery, and support acceptance criteria included in delivery.

## Proposed domain boundaries (assumptions pending validation)

| Domain | Core records | Derived views |
|---|---|---|
| Identity & access | user account, role assignment, access scope | active users, access review |
| Staff directory | staff profile, operational identifier, active status | searchable roster |
| Scheduling | shift, assignment | shift plan, coverage |
| Attendance | sign-on/off event, correction | attendance state, lateness/early flags |
| Assets | asset, asset type, custody event, condition event | currently issued, overdue/unreturned |
| Deployment | deployment/task, assignment event, operational note | current deployment board |
| Incident/radio | incident, radio entry, link/reference | chronological log, restricted incident view |
| Configuration | controlled list, threshold, site/team | validated choices |
| Assurance | audit event, export job, retention action | security/admin reports |

## Explicitly out of scope until authorised

- Clinical/counselling records, equality monitoring, disciplinary records, and data outside the approved incident form. The planned incident form may include welfare, safeguarding, and alleged-offence information only after field-level, lawful-basis, retention, access, and DPIA controls are approved.
- Continuous staff location tracking or historical movement trails; “tracker” means issued equipment only.
- Automated performance scoring, profiling, or consequential decision-making.
- Payroll, HR case management, public reporting, facial/biometric identification, and covert monitoring.
- Uploading live spreadsheet data to development, analytics, AI, issue trackers, logs, or test systems.

## Non-functional priorities

1. Confidentiality and correct authorisation.
2. Integrity and traceability of operational events.
3. Availability during live operations, with a documented fallback procedure.
4. Usability for a less technical, time-pressured team.
5. Data minimisation and controlled lifecycle.
6. Maintainability and low operational burden for a small team.
7. Brand consistency with the Safer Spaces public website, using the approved logo, coral/off-white/charcoal palette, Orpheus Pro heading style, and Adobe Garamond Pro body style subject to licensing and accessibility. See `design-system.md`.

## Minimum discovery outputs before prototype approval

- Process walkthroughs for normal, correction, failure, and emergency paths.
- Field-level data inventory and purpose map.
- Controller/processor and data-owner identification.
- Role/access matrix approved by an accountable owner.
- Retention schedule with documented rationale.
- DPIA screening and decision; full DPIA where indicated.
- Agreed offline and device-loss model.
- Defined incident/radio-log boundary and migration scope.

## Current workbook findings

The authorised source is one workbook with 17 tabs. It covers instructions, dashboard, deployment, staff lookup/register, attendance, kit/uniform, radio assignments, lists/setup, combined sign-on/off form responses, equipment-update responses, derived kit/radio line items, and rota names. Current workflow details include:

- event windows of 1–14 days and overnight shifts;
- sign-on that can issue initial kit/radio/earpiece/tracker allocations;
- on-shift issue/return without signing the person off;
- sign-off that closes attendance and outstanding assignments;
- 20+ minute late, late-sign-off, and early-sign-off flags;
- searchable staff status combining rota, attendance, deployment, and outstanding equipment;
- deployment task plus optional tracker/operational note;
- configuration lists for staff status, kit, size, condition, radio status, location, earpiece type, deployment task, and tracker notes;
- event archive/reset in the workbook, which the application will replace with isolated event records and lifecycle states rather than clearing shared tables.

The response sheets include duplicate and legacy columns. They are migration inputs, not a target database schema.

## Formal incident-form direction

The future incident form is expected to record incident category/subcategory, what happened, location, relevant people, current status, contacts/referrals made, and welfare status. This is a preliminary description, not an approved schema. The design must distinguish the person supported, reporter, witness, alleged perpetrator, staff author, and external contact instead of placing every person into one generic field.

### Incident visibility classifications

- `General`: readable by accounts granted ordinary incident access.
- `Restricted` (also described operationally as redacted): completely absent for users without `incident.restricted.read`; full content requires that separate capability. Create, update, export, offline-download, and classification-management permissions are separate grants.

Classification applies throughout the data path: APIs, search, dashboards, notifications, offline storage, exports, reports, audit/support tools, backups, and migration. Enforcement is server-side. Restricted content must not leak through titles, snippets, people lists, URLs, error messages, narrow counts, logs, or caches.

Changing `General` to `Restricted` requires `incident.classification.restrict`; without it the user cannot see the control or successfully call the API. Changing `Restricted` to `General` requires `incident.classification.unrestrict`, re-authentication, a mandatory reason, and an audit event, but no second approval. Restricting applies immediately and invalidates ordinary cached copies at the next connection.

### Full incident purge

Provide an irreversible, per-incident `Full purge` operation controlled by `incident.purge`. It is online-only and cannot be queued offline. Selecting it navigates to a dedicated confirmation page; opening that page does not delete anything. Final submission requires fresh MFA/re-authentication, a reason, typed case-reference confirmation, an explicit irreversible-action checkbox, and a legal/police/safeguarding preservation-hold check.

The confirmation page must identify the intended incident using the minimum safe context, state exactly which live/derived stores are covered, explain that external exports/screenshots cannot be recalled, show whether a hold blocks the action, and provide clearly separated `Cancel` and `Permanently purge incident` actions. The destructive button remains disabled until all requirements are satisfied. Browser back, closing the page, timeout, failed MFA, or choosing cancel performs no purge.

Successful purge removes the incident and its data from primary tables, revisions, relationships, search indexes, caches, offline-sync manifests, generated documents, export staging, attachments, thumbnails, analytics, and temporary stores. Devices receive deletion tombstones at next sync. Existing standalone exports or screenshots cannot be technically recalled and are governed separately.

Encrypt each incident with an incident-specific data key wrapped by a managed master key. Purge destroys the wrapped incident key and deletes live ciphertext; residual ciphertext in immutable backups becomes unreadable before backup expiry. Preserve only a non-content security audit event that a purge occurred.

Purge fails closed while a preservation hold is active. Hold removal and purge are separate actions. One account holding `incident.purge` may execute it without second-person approval or a cancellation window after completing the required re-authentication, reason, and typed confirmation.
