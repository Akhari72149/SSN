# Safe Migration Plan from Google Sheets

## Non-negotiable rule

No live spreadsheet data may be downloaded, copied, sampled, uploaded, logged, or stored in this project until the data owner explicitly authorises a defined migration exercise. Discovery uses schemas, counts supplied by authorised owners, and synthetic examples only.

## Migration principles

- Preserve the source before transformation; never edit the only copy.
- Minimise scope: migrate only records needed for defined production purposes and within approved retention.
- Make mappings deterministic, repeatable, reviewable, and idempotent.
- Separate migration credentials and workspace from development.
- Reconcile both totals and meaning; a matching row count is insufficient.
- Maintain a rehearsed rollback until production acceptance.

## Inspected source structure

The authorised workbook has 17 tabs and uses form responses plus formula/derived line-item tabs. The sign-on/off response sheets contain duplicated and legacy headings, while the operational logs already generate record/allocation/assignment IDs. Migration must map the canonical operational logs and source response provenance together; it must not import each tab independently and thereby duplicate the same attendance or equipment transaction.

All currently used information is proposed for migration, but this is not yet approval to retain every field indefinitely. Each field still requires purpose, classification, destination, and retention review. Names from PDFs must be imported through a controlled roster-import workflow with validation and duplicate review; PDF text is not automatically authoritative identity data.

## Stages and gates

### 1. Inventory and authority

- Name controller/data owner, migration owner, approver, and operators.
- Catalogue sheets/tabs, fields, formulas, validations, scripts, named ranges, permissions, linked forms, exports, and downstream reports without copying row contents.
- Map each field to purpose, classification, lawful basis/condition where applicable, retention, destination, transform, and rejection rule.
- Decide what must not migrate: stale rows, duplicates, unnecessary free text, obsolete lists, hidden helper data, unsupported sensitive categories.
- Complete DPIA/privacy/security and processor decisions before handling live data.

**Gate:** signed data-migration specification and authorisation.

### 2. Synthetic rehearsal

- Build representative synthetic workbooks covering duplicates, blank/invalid dates, daylight-saving changes, renamed staff, missing returns, conflicting assignments, malformed IDs, formulas, and free text.
- Implement schema validation, deterministic identifiers, transformations, quarantine, and reconciliation reports.
- Test repeatability, least-privilege access, redacted logs, encryption, cleanup, and rollback.

**Gate:** all migration tests pass with no sensitive data.

### 3. Protected source snapshot

- Schedule a change window and communicate responsibilities.
- Create an owner-controlled, timestamped, read-only source snapshot using Google-native version/copy controls plus an approved encrypted export if required.
- Record workbook version, tab/range metadata, row counts, file hashes for exported artifacts, and authorised access—not row data in general logs.
- Restrict source and migration workspace to named operators; disable sync to personal devices and consumer services.

**Gate:** backup restore/access test and chain-of-custody record approved.

### 4. Trial migration

- Run in an isolated non-public migration environment using production-equivalent controls.
- Validate and quarantine errors; never silently coerce ambiguous identity, time, or asset values.
- Reconcile per tab/entity: source, excluded by approved rule, accepted, rejected, duplicates merged, destination created/updated.
- Sample records by dual control, including relationships and chronological event histories. Check computed dashboards and custody/attendance states.
- Remove trial data according to the approved temporary retention window.

**Gate:** data owner signs reconciliation and every exception.

### 5. Controlled pilot and parallel run

- Pilot with a small authorised cohort/operation and only the minimum live data needed.
- Define one system of entry for each data domain to avoid unresolvable dual writes. If parallel entry is unavoidable, assign reconciliation owners and daily cutoffs.
- Compare key measures: planned staff, signed-on/off states, open asset custody, active deployments, and exceptions.
- Capture issues without pasting personal data into tickets; use record IDs and restricted channels.

**Gate:** success metrics, security criteria, user acceptance, incident readiness, and support coverage approved.

### 6. Cutover

- Announce freeze/cutoff, final backup, final incremental extraction, and owner responsibilities.
- Run repeatable import, reconciliation, smoke tests, role checks, and dashboard checks.
- Require explicit go/no-go approval. Preserve a time-bounded rollback point.
- Roll back if identity mapping, material reconciliation, authorisation, availability, or integrity criteria fail.

### 7. Closure and Sheets disposition

- Make the original tracker read-only immediately after acceptance; revoke edit integrations/scripts and unnecessary shares.
- Decide whether to securely delete it or retain a read-only archive based on documented purpose and retention—not convenience.
- If archived, name owner, access group, review/deletion date, legal holds, and subject-right search process. “Archived” data remains personal data.
- Delete temporary exports, working copies, transformation files, credentials, and trial databases; capture deletion evidence.
- Review access and migration audit logs; close exceptions; run post-migration review.

## Reconciliation controls

| Control | Pass condition |
|---|---|
| Completeness | Source = approved exclusions + rejected/quarantined + destination outcomes for every scoped entity |
| Identity | No ambiguous person mapping; unresolved cases quarantined |
| Relationships | Every assignment/custody/event references an existing valid parent or documented exception |
| Time | Timezone and DST handling verified; original timestamps preserved where valid |
| State | Open/closed shifts, sign-on status, active custody, and deployments match approved source snapshot |
| Uniqueness | Duplicate rules deterministic; no accidental merging by name alone |
| Integrity | Export hashes/version identifiers and import batch IDs recorded |
| Security | Named access only; no data in ordinary logs/tickets/analytics; temporary copies inventoried |

## Rollback

Trigger rollback on material unreconciled variance, broken access control, corrupted event chronology, unacceptable performance/availability, or incident declaration. Stop writes, preserve evidence, notify the incident/migration leads, disable new-system access if necessary, resume the designated source process from the agreed cutoff, reconcile any new-system-only events through an approved manual process, and do not retry until the cause and controls are reviewed.
