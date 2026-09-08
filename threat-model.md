# Initial Threat Model and Security Acceptance Criteria

Status: discovery model. Revisit after workflow, data inventory, architecture, vendors, and offline behaviour are confirmed.

Update: limited offline operation and mixed personal/company devices are confirmed. Self-hosting is preferred but the exact server platform is unresolved. These increase device-loss, sync-conflict, patching, network-isolation, backup, and administrator-compromise risk and are production-gate issues.

## Protected assets and trust boundaries

Primary assets are staff identity/contact data, attendance history, live operational/deployment information, incident/radio entries, equipment custody, credentials/sessions, exports, audit records, secrets, backups, and service availability.

Trust boundaries exist between user/device and web edge; edge and application; application and database/object storage; application and identity/email/monitoring providers; admin/operator roles; production and non-production; online and offline/local device storage; and Google Sheets migration tooling and the new system.

## Principal threat scenarios

| ID | Threat and impact | Priority controls |
|---|---|---|
| T1 | Stolen/phished account exposes staff and live operations | MFA/passkeys, managed identity, short sessions, re-auth for exports/admin, anomaly alerts, rapid revocation |
| T2 | Over-broad role or broken object-level authorisation leaks another team/site | Deny-by-default policy checks on every request, scoped roles, negative authorisation tests, quarterly access review |
| T3 | Shared/unlocked device exposes cached data | Minimal local storage, no persistent sensitive cache, screen timeout, remote session revocation, privacy-safe notifications |
| T4 | Offline queue is read, tampered with, replayed, or conflicts | Narrow offline scope, encrypted platform storage where feasible, signed/idempotent mutations, expiry, server validation, conflict UX |
| T5 | Free text contains excessive welfare, health, allegation, or third-party data | Structured fields, warning copy, restricted domains, training, review/redaction path, no sensitive content in telemetry |
| T6 | Mass export/screenshot or insecure download causes disclosure | Export entitlement, step-up auth, minimum columns, watermark/manifest, short-lived single-use download, rate/volume alerts |
| T7 | Attendance or custody record is falsified/backdated/deleted | Append-only events, server time, correction records, actor attribution, integrity checks, privileged override review |
| T8 | Injection/XSS/CSRF/API abuse changes or extracts data | Parameterised queries, schema validation, output encoding, CSP, same-site secure cookies, CSRF protection, API rate limits |
| T9 | Dependency/cloud/supply-chain compromise | Locked dependencies, scanning, patch SLA, protected CI, signed builds/provenance where practical, vendor due diligence |
| T10 | Secrets leak via repo, logs, client bundle, or support | Secret manager, scoped short-lived credentials, log redaction, rotation runbook, pre-commit/CI scanning |
| T11 | Ransomware/deletion/outage prevents live operation | Isolated backups, tested restore, multi-AZ managed service, graceful fallback procedure, status communication |
| T12 | Audit log is missing, altered, or itself over-collects | Append-only restricted sink, integrity/retention controls, minimal metadata, clock sync, alerting, separate admin access |
| T13 | Spreadsheet migration maps people/assets incorrectly or duplicates events | Read-only source snapshot, deterministic IDs, validation rules, reconciliation totals/exceptions, dual approval, rollback |
| T14 | Insider browses or changes records without need | Least privilege, purpose-based views, audit and alerting, separation of duties, joiner/mover/leaver controls |
| T15 | Admin recovery is socially engineered or becomes a backdoor | Two-person recovery, verified identity, no universal shared account, time-limited elevation, full notification/audit |
| T16 | Live deployment data reveals location/patterns | Limit precision/history, team/site scoping, short retention, no public/shared-screen detail, risk review before tracking |
| T17 | Unsupported or weakly hardened self-hosted server compromises every domain | Supported OS, patch SLA, segmented network, non-public database, MFA/VPN admin, separate service identities, vulnerability monitoring |
| T18 | Concurrent events leak or corrupt one another’s data | Mandatory event ID on records, event-scoped authorisation, database constraints, cross-event negative tests, explicit director overview capability |
| T19 | Host timezone or DST conversion causes incorrect shifts, pay flags, chronology, or evidence | UTC storage/runtime, explicit `Europe/London` event timezone, timezone-aware conversion, DST gap/overlap tests, show offset in exports |
| T20 | Broad organisation-wide access exposes unrelated incident records | Separate operational/case capabilities, case assignment/need-to-know, sensitive-field permissions, access reason where appropriate, browsing alerts |
| T21 | Offline incident data is extracted from a lost or personal device | Selective case pinning, encrypted device store, device-bound keys, short offline lease, app lock, local expiry, remote revocation |
| T22 | Concurrent offline edits overwrite or distort incident evidence | Immutable revisions, field conflict detection, server/device times, author attribution, explicit merge/review, preserve both versions |
| T23 | Restricted incident existence/content leaks through lists, search, exports, notifications, counts, direct IDs, logs, URLs, or offline sync | Server-side non-disclosure policy, indistinguishable not-found response, response shaping, permitted-view aggregates, tests across every channel |
| T24 | User without authority restricts/unrestricts an incident or a stale offline client bypasses the UI | Separate restrict/unrestrict permissions, dedicated server commands, re-authentication, mandatory reason, server recheck, audit/alert |
| T25 | Malicious or accidental purge destroys an incident required for support/evidence | Dedicated confirmation page, `incident.purge`, fresh MFA, typed reference, irreversible checkbox, reason, hold check, short-lived intent token, audit and alerting |
| T26 | Purged incident survives in backups, exports, indexes, caches, attachments, or offline devices | Per-incident key destruction, purge inventory/orchestrator, deletion tombstones, expiry, verification, third-party-copy boundary |

## Security design rules

- Authentication proves identity; authorisation is enforced server-side for each action and object.
- Prefer workforce SSO with phishing-resistant MFA/passkeys. If passwords are unavoidable, use an established identity provider, breached-password protection, secure reset, and no custom password storage.
- Use `Secure`, `HttpOnly`, `SameSite` cookies; rotate sessions on login/privilege change; idle and absolute timeouts; revoke on role change, offboarding, recovery, or suspected compromise.
- Model permissions as action + resource + scope. Roles are convenience bundles, never the enforcement primitive.
- Encrypt traffic using current TLS and provider-managed encryption at rest, including backups. Consider field-level encryption only for a demonstrated threat because it complicates search and key recovery.
- Keep secrets in a managed secret store, never source, client code, tickets, or environment files committed to version control. Separate environments and rotate.
- Validate types, sizes, formats, state transitions, and ownership server-side; parameterise database access; encode output; scan uploads if uploads are later approved.
- Apply per-user/IP/device-aware limits to login, search, mutation, export, and recovery; use progressive friction without locking out an entire operation.
- Observability must exclude note bodies, contact data, tokens, full request bodies, and spreadsheet rows.

## Proposed roles (validate in discovery)

| Role | Default capability | Explicitly excluded |
|---|---|---|
| Staff/self-service | View own shift; perform authorised self actions | Other staff records, exports, configuration |
| Check-in/equipment operator | Assigned-site attendance and custody actions | Historical bulk data, incident detail, role admin |
| Supervisor | Current scoped operation, corrections with reason | Cross-organisation access, security administration |
| Incident/radio operator | Create/read scoped log entries | HR/welfare records, user administration |
| Operations manager | Plans, dashboards, authorised reports for scope | Identity-provider/security configuration by default |
| Data/privacy administrator | Retention, subject-right workflows, approved exports | Routine operational editing where separation is possible |
| Security administrator | Accounts, roles, sessions, audit/security events | Operational note content unless break-glass is approved |

No shared accounts. Temporary privilege expires automatically. Break-glass requires named use, reason, strong re-authentication, notification, and retrospective review.

## Security acceptance criteria for pilot/production

- [ ] Approved data inventory, DPIA decision, processor register, role matrix, retention schedule, and incident plan.
- [ ] MFA mandatory for privileged users and preferably all users; no shared credentials; tested joiner/mover/leaver flow.
- [ ] Automated tests cover every role/action/scope combination, including ID tampering and deny cases.
- [ ] OWASP ASVS-informed review completed; no unresolved critical/high findings, and medium findings risk-owned with dates.
- [ ] Independent penetration test or qualified review of authentication, authorisation, exports, offline storage, and admin recovery before production.
- [ ] TLS enforced; secure-cookie and browser security headers verified; secrets scan and dependency scan pass.
- [ ] Sensitive values absent from application, access, analytics, error, and client logs; synthetic data only outside production.
- [ ] Material create/change/correct/delete/export/admin actions create immutable, queryable audit events without storing unnecessary content.
- [ ] Export requires entitlement and re-authentication, uses short expiry, and is fully audited.
- [ ] Rate limits and abuse alerts tested for login, lookup, mutations, exports, and recovery.
- [ ] Backup restoration meets approved RPO/RTO; failure/fallback drill completed.
- [ ] Account compromise, lost device, data leak, ransomware, and vendor outage tabletop exercises completed with named responders.
- [ ] Monitoring alerts on repeated auth failure, unusual exports/search volume, privilege changes, break-glass use, retention failure, and backup failure.
- [ ] Accessibility audit and usability tests cover time-pressured mobile workflows and error recovery.
- [ ] Migration rehearsal reconciliation is exact or every exception is documented and approved; rollback tested.
- [ ] Time tests cover GMT/BST boundaries, overnight shifts, offline clock skew, ambiguous/nonexistent local times, and a host configured to a different timezone.

The ICO frames security around confidentiality, integrity, and availability with risk-appropriate organisational and technical measures: [ICO guide to data security](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/a-guide-to-data-security/). The NCSC’s current small-organisation guidance covers backups, devices, accounts, and incident readiness: [NCSC small organisations guide](https://www.ncsc.gov.uk/collection/small-business-guide/small-business-guide-actions).
