# Open Questions and Decision Register

Status: updated after sponsor answers and authorised read-only workbook inspection on 15 August 2026.

## Confirmed decisions

- Anna MacGregor is the currently named accountable director. Privacy, security, service, operational, and safeguarding responsibilities/deputies still need documenting.
- Application accounts are limited to directors, managers, supervisors, and administrators. Access remains adjustable per person.
- Safer Spaces works with paid staff and volunteers. Attendance flags may relate to pay but are not to make automatic decisions.
- Several events/festivals may run simultaneously and must have separate operational records and access scopes.
- Devices are a mix of personal and company phones, tablets, and laptops.
- Offline capture is required.
- Shared dashboards show aggregate numbers only.
- Trackers are festival-provided equipment, not location monitoring, and are not used at every event.
- Radios, earpieces, and trackers are assigned independently. Radios are numbered; most kit is tracked by type, size, and quantity.
- Shifts have set times, may be overnight, and need `On break`/`Break completed` states.
- Staff lookup may cover the full register for users granted that capability.
- The radio log is an informal on-shift coordination log. Formal incident reports/evidence will be a separate later form/module.
- Incident reporting needs aggregate case counts plus authorised individual and bulk form export.
- Notifications may be selective and display minimal text such as `New SA case`, with no case/person details on a locked screen.
- All currently used workbook information is proposed for migration, subject to purpose and retention review.
- Directors will own onboarding/offboarding, access reviews, support, patching, alerts, incidents, restores, and supplier management.
- Users have organisation-wide visibility rather than festival-restricted access, subject to individual functional and case permissions.
- No existing workforce identity provider is available.
- The host is a Contabo VPS running Windows Server 2016.
- Nearly all functions should work offline; staff-list access and incident-form creation, viewing, and updating are the priorities.
- Recovery is required quickly during events, but numeric recovery targets remain undecided.
- Incident retention is desired in case police require records; this still needs a formally advised retention schedule.
- Incidents have two visibility classifications: `General` and `Restricted` (redacted). Users without restricted-read permission see no record, placeholder, or count. Separate permissions control reading, setting, and removing the restricted classification; no second approval is required.
- Per-incident full purge is required. It has its own permission, is online-only, removes live/derived data, cryptographically erases backup recoverability, and is blocked by preservation holds.

## P0 — required before architecture/prototype scope is frozen

1. Assign named owners/deputies for data-controller decisions, service operation, privacy, security, operations, and safeguarding. Confirm whether Anna MacGregor holds all roles initially.
2. For each workflow in the table, state whether it affects pay, discipline, safeguarding/case decisions, police disclosure, or external reporting. The operational purposes are accepted as written.
3. For incidents, confirm which people are recorded (person supported, reporter, witness, alleged perpetrator, staff author) and whether health/disability, safeguarding, suspected-offence, police-reference, referral, or equality data may be included.
4. Confirm existing documents or `none`: privacy notices, DPIA, retention, access control, safeguarding, personal-data breach, and special-category/criminal-offence data policies.
5. Obtain formal advice on retention and police disclosure. What police requests have occurred/are expected, and should a preservation hold suspend deletion for a named case?
6. **Answered:** ordinary users see nothing. `incident.classification.restrict` controls setting a record to restricted; `incident.classification.unrestrict` controls returning it to general. Both are audited and permission-checked by the server; no second approval is required.
7. What is the longest offline period? May the whole staff list be stored offline? How many incident forms may a device keep, and should users explicitly mark cases for offline use?
8. Can all users enrol MFA and recovery details? Who may reset another user, and should privileged recovery require two directors?
9. For the Contabo VPS, confirm public exposure, firewall/VPN, backup destination, patch owner, other workloads, and the upgrade plan beyond Server 2016.
10. Choose pilot recovery targets. Suggested starting point: no loss of server-accepted transactions, up to 15 minutes of infrastructure data loss after catastrophic failure, and restoration within four hours during an event. Device-only actions remain queued until sync.
11. **Answered:** purge has its own independently assigned `incident.purge` permission and a dedicated confirmation page. One authorised account can execute after re-authentication, reason, typed incident reference, irreversible-action checkbox, and hold checks; navigating away or cancelling deletes nothing. No second approval or cancellation window is required.

## P1 — workflow detail

12. Shift rules: cancellation, reassignment, split shifts, early/late thresholds, missed sign-off, and how overnight shifts are displayed.
13. Sign-on currently requires no identity check. Who may perform it—staff member, desk operator, or supervisor—and what prevents selecting the wrong person?
14. Deployment: one current task or several; whether changes retain start/end time and changer; priority; supervisor reassignment; notification; and structured versus free-text notes.
15. Corrections: which mistakes (identity, time, shift, break, equipment, deployment, form) may a supervisor correct alone, which need a second approver, and who may view originals/reasons?
16. Lists/setup: who owns each list in the application and who may change values during a live event?
17. For event closure, which records remain operationally searchable, which become restricted archive, and which can be deleted/anonymised?
18. Formal incident form: when ready, provide a blank field list/template and workflow rather than completed case data.

## P1 — integration and migration

19. The workbook uses Google Forms/form-response tabs, formulas, and refresh behaviour. Are there Apps Script projects/triggers, emails, Forms URLs, external workbooks, dashboards, or API tools? Check Extensions → Apps Script and Triggers without sharing credentials.
20. Are stable Staff IDs present for every person? The phrase “add names from a PDF” needs clarification: what PDF, who owns it, and how are duplicate/changed names resolved?
21. Parallel running means choosing one official system while comparing the other. During pilot, should the Sheet remain official with daily reconciliation, or should the app be official for one test event with the Sheet as emergency fallback?
22. Besides case counts and incident-form export, list required attendance, staffing, equipment, deployment, payroll, funder, or event-organiser reports and their recipients.

## P2 — later product choices

23. Is Microsoft 365 licensing/governance available, making Entra ID or Power Apps/Dataverse candidates?
24. Which browsers/OS versions and accessibility needs must be supported across phones, tablets, and laptops?
25. Are QR/barcode scanning, printing, or radio-system integrations required?
26. Who should receive notifications, by which channels, and can recipients opt out? Formal incident notifications require a dedicated threat/privacy review.
27. Uploads/photos remain deferred. When revisited, define purpose, permitted file types, retention, police handoff, malware scanning, and access.

## Workflow confirmation table

For each row, confirm or amend the purpose and say whether it affects pay, discipline, safeguarding, case decisions, or external reporting.

| Workflow | Proposed purpose |
|---|---|
| Staff register | Maintain the operational roster and stable staff ID, preferred name, status, type, and event shifts |
| Shift plan | Plan event coverage over 1–14 days, including overnight shifts |
| Sign on/off | Establish who is currently working and record actual attendance times |
| Break state | Show current availability and that a break was taken |
| Kit/radio/earpiece/tracker issue/return | Maintain current custody, quantity, condition, and outstanding returns |
| Deployment | Show each signed-on person’s current operational task and minimal tracker/note context |
| Staff lookup | Combine roster, attendance, current deployment, and outstanding equipment for operational use |
| Aggregate dashboard | Show counts only for staffing, attendance, deployment, equipment, and later case totals |
| Radio log | Keep the operator’s chronological on-shift coordination notes; not the formal evidence record |
| Formal incident form | Capture formal case/report information and enable individual/bulk authorised exports; details deferred |
| Event close/archive | Close one event without affecting concurrent events; preserve/delete records according to approved retention |

## Current assumptions still awaiting validation

- UK-based single organisation; Europe/London; English-first interface.
- Per-person capability grants are grouped into reusable role templates but can be overridden and event-scoped.
- The app is self-hosted with PostgreSQL on a supported, hardened platform.
- The host currently uses `Europe/Berlin`, but the application/database operate in UTC and display event times through `Europe/London` so GMT/BST changes are automatic.
- Formal incidents/C4 content and full offline case capture remain outside the initial operational MVP.
- Development/test use synthetic data only. Live data is handled solely within an explicitly approved migration environment.
