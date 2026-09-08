# PostgreSQL Database Model

Status: logical model; migration names/types may evolve during implementation.

## Core conventions

- UUID primary keys; never use names or spreadsheet row numbers as identifiers.
- `timestamptz` for instants, stored/processed in UTC; event timezone stored as `Europe/London`.
- `created_at`, `updated_at`, row version and actor/source on mutable projections.
- Append-only events/revisions for material operational history.
- Foreign keys, check constraints and transactions protect integrity.
- No production personal data in development/test.

## Logical entities

| Domain | Tables/entities |
|---|---|
| Identity | `users`, `credentials_external_refs`, `mfa_methods`, `sessions`, `recovery_codes`, `devices` |
| Access | `capabilities`, `user_capability_grants`, `permission_templates`, `template_capabilities`, `access_changes` |
| Events | `events`, `event_days`, `event_lifecycle_events` |
| Staff | `staff`, `staff_aliases`, `staff_event_status`, `roster_import_batches`, `roster_import_rows` |
| Scheduling | `shifts`, `shift_assignments`, `shift_assignment_events` |
| Attendance | `attendance_sessions`, `attendance_events`, `break_events`, `attendance_corrections` |
| Equipment | `equipment_types`, `numbered_assets`, `custody_allocations`, `custody_events`, `condition_events` |
| Deployment | `deployment_tasks`, `deployment_assignments`, `deployment_events` |
| Radio log | `radio_log_entries`, `radio_log_revisions` |
| Incidents | encrypted `incidents`, `incident_revisions`, `incident_people`, `incident_actions`, `incident_assignments`, `incident_holds` |
| Cryptography | `incident_wrapped_keys`, key-provider reference and key version; no master key in database |
| Offline | `sync_devices`, `sync_leases`, `sync_operations`, `sync_conflicts`, `sync_tombstones` |
| Exports | `export_jobs`, `export_files`, `export_download_events` |
| Assurance | `audit_events`, `security_events`, `retention_jobs`, `purge_jobs`, `purge_manifests` |
| Setup | versioned controlled-list tables or `configuration_values` with event/global scope |

## Important relationships

- Every operational record belongs to an `event`, except global staff/users/setup.
- A `staff` record is not a login `user`; link only where required.
- A shift assignment links staff and event shift; attendance events reference the assignment where known.
- Custody allocation records one equipment type/asset and recipient; quantity assets and numbered assets use explicit constraints.
- Deployment history is event-based and never overwritten.
- Incident people/actions are children encrypted under the incident’s key and cascade only through controlled purge orchestration.

## Incident encryption and purge

Generate a random data-encryption key per incident. Encrypt sensitive incident fields/children with authenticated encryption and wrap the key using an external master key. Store ciphertext, nonce, algorithm/key version and wrapped key. Search uses deliberately minimised derived tokens/indexes that are included in purge inventory; do not create uncontrolled plaintext indexes.

Purge destroys the wrapped key first at the irreversible boundary, deletes live rows/objects/index entries and distributes tombstones. `purge_manifests` contains job status, actor, time and store-completion flags but no incident identifier or content beyond a non-reversible internal correlation where necessary.

## Authorisation

The application service enforces capabilities on every query/command. Reinforce high-risk paths with database roles/views or row-level policies where practical. PostgreSQL is not internet-accessible; application and migration accounts are separate and least-privileged.

## Audit

Audit records actor user/session/device, action, target type and opaque ID, permitted result, timestamp, request/correlation ID, reason where required and minimal before/after metadata. Never copy incident narratives, welfare details, tokens or credentials into audit logs.

## Backup/recovery

Use encrypted PostgreSQL backups and point-in-time recovery with off-host copies. Test restoration. Per-incident key destruction prevents recovery of purged content from backups. Restoration must rerun retention/tombstone processing before returning to service.

