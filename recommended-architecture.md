# Recommended Architecture

## Recommendation

Build a modular monolith as a responsive, installable web application (PWA): TypeScript, Next.js/React, a managed PostgreSQL database in an appropriate UK region, and a mature managed workforce identity provider supporting SSO and phishing-resistant MFA/passkeys. Deploy on a managed platform with WAF/rate limiting, encrypted storage/backups, structured redacted logging, and separate security audit storage.

This is a proposed direction, not a vendor commitment. The sponsor expects self-hosting with PostgreSQL, so the managed-platform option is no longer assumed. Validate the exact server OS/version, patching, network architecture, physical/administrative access, backup isolation, identity ecosystem, connectivity, skills, and recovery capability before committing. If the team already has mature Microsoft 365 governance/licensing, Power Apps/Dataverse remains a comparison option.

## Hosting gate

The Cloud VPS 20 is described as Windows Server Datacenter Edition “2012 or 2016”, which does not identify the installed version. Neither is an acceptable long-term production base for this new system:

- Server 2012/2012 R2 standard extended support ended on 10 October 2023. Year 3 Extended Security Updates end on 13 October 2026 and apply only if the VPS is correctly licensed/enrolled.
- Server 2016 extended support ends on 12 January 2027.

Do not deploy production until the provider confirms the exact product/version/build and supplies a supported upgrade path. Prefer a supported Linux LTS host for the containerised application/PostgreSQL, or Windows Server 2022/2025 if Windows administration is mandatory. Windows Server 2022 extended support runs to 14 October 2031, but the chosen OS still requires active patching and hardening.

Self-hosting is acceptable only after proving firewall segmentation, TLS certificate automation, non-public database access, least-privilege service accounts, protected admin access with MFA/VPN, off-host encrypted backups, restore testing, monitoring, vulnerability/patch ownership, capacity, power/network resilience, and incident escalation. The existing server’s other workloads must not share unrestricted credentials or database trust with this application.

## Time architecture

- Run application processes, PostgreSQL sessions, background jobs, containers, and logs in UTC regardless of the host’s `Europe/Berlin` timezone.
- Store timestamp instants as PostgreSQL `timestamptz`; do not store formatted UK clock strings as the authoritative value.
- Store the event timezone separately using the IANA identifier `Europe/London`. Convert only at input/output boundaries with a timezone-aware library and current timezone database.
- Parse planned shifts as local event date/time plus timezone, then resolve to UTC. Never add a hard-coded one-hour BST adjustment.
- Make overnight shifts explicit with start and end dates, not only `HH:MM - HH:MM` text.
- Test both UK clock changes: nonexistent local times during the spring-forward gap and duplicated local times during the autumn fallback. Ambiguous entry requires an offset/occurrence choice and audit record.
- Export both a clear UK local timestamp (including `GMT`/`BST` or numeric offset) and UTC where reconciliation/evidence requires it.
- Use server-authoritative UTC for audit and receipt time; preserve device-reported occurrence time separately for offline events, with sync time and clock-skew diagnostics.

## Logical design

```text
Mobile/desktop browser (PWA shell; minimal sensitive cache)
        |
Managed edge: TLS, WAF, rate limits, security headers
        |
Next.js application (UI + server API; modular domain services)
        |---------------- Managed identity provider
        |---------------- Redacted telemetry/alerts
        |
Managed PostgreSQL
  - operational tables
  - append-only domain events/corrections
  - authorisation scopes
  - audit outbox
        |
Restricted append-only audit sink + encrypted backups
```

Keep one deployable service initially, but enforce modules for identity/access, staff, scheduling, attendance, assets, deployment, incident/radio, configuration, retention/exports, and audit. Avoid microservices until scale or ownership boundaries justify them.

## Data and integrity model

- Relational current-state tables for efficient operational views.
- Append-only domain events for attendance, custody, deployment changes, corrections, and archive/closure.
- Transactions update event and current projection together, or use an outbox pattern for audit delivery.
- Optimistic version column prevents silent overwrites.
- Database constraints enforce unique asset labels within scope, valid timestamps, references, and allowed status combinations.
- Soft deletion is not the retention strategy. Use lifecycle states where operationally needed, then controlled hard deletion/anonymisation under policy.
- Incident/radio records remain a segregated module/schema and permission surface; do not place their text in general dashboards or search indexes.

## Identity, sessions, and authorisation

- Federate to an existing governed workforce identity tenant where possible; mandatory MFA, preferably passkeys/security keys for privileged users.
- Server-side sessions in secure, HTTP-only, same-site cookies. Short idle timeout for operational terminals, sensible absolute lifetime, rotation on authentication/privilege change, central revocation.
- Re-authentication for exports, role changes, recovery, retention override, and break-glass.
- Policy checks combine action, resource, site/team/operation scope, and record classification. UI hiding is never an access control.
- Two-person approval for exceptional recovery and destructive/large-scale administrative actions.

## PWA and resilience

Offline operation is required for nearly all workflows, with staff-list access and incident-form create/view/update identified as core. This materially changes the risk and technical design. Phase 1 must prototype offline encryption, authorisation expiry, selective case download, conflict handling, and remote revocation before the production model is frozen. Cache only records deliberately assigned or recently accessed by an authorised user; never download the complete historical incident database by default. Use an encrypted local database, device-bound keys, short offline authorisation leases, queued-event IDs, server-side permission revalidation, replay protection, merge/review workflows, and automatic local expiry.

Incident forms require explicit case assignment or offline pinning, re-authentication before download, minimal attachments, and device-security prerequisites. On personal devices, offline incident detail may be prohibited unless device encryption, a supported OS, screen lock, and application PIN/biometric unlock are verified.

Each action must display whether it is saved locally or accepted by the server. Offline sign-on must not silently allocate the same numbered radio/tracker twice: conflicts enter supervisor review and both original device events remain auditable.

## Security and operations

- Infrastructure as code; protected main branch; reviewed changes; locked dependencies; automated SAST, dependency, secret, and migration checks.
- Production secrets held in managed secret storage, least-privilege service identities, rotation and emergency-revocation runbooks.
- TLS in transit and managed encryption at rest for database, replicas, audit store, exports, and backups.
- Content Security Policy, anti-CSRF controls, safe output encoding, schema validation, parameterised queries, size limits, and safe error messages.
- Logs carry request/event IDs, actor pseudonymous ID, action, result, scope and timing—but not note bodies, contact values, credentials, or spreadsheet rows.
- Alerts cover auth abuse, privilege/recovery events, unusual lookup/export volume, audit delivery failure, retention failure, elevated error rates, and backup failure.
- Define service level, RPO/RTO, on-call ownership, vendor escalation, and manual fallback before pilot.

## Accessible, simple workflows

- Home screen prioritises “today”, sign on/off, issue/return, and current deployment.
- Use large touch targets, explicit labels, high contrast, visible focus, keyboard support, and errors linked to fields.
- Use controlled choices and scanning of asset QR/barcodes where useful; always provide accessible manual entry.
- Confirm high-impact actions with a plain-language summary; avoid confirmation fatigue for reversible actions.
- Shared-screen dashboard mode must show aggregates or operational identifiers only, with an automatic privacy timeout.

## Environment model

- Local/development: synthetic seeded data only.
- Test/staging: synthetic data only by default; any exceptional production-like data requires written approval, minimisation/pseudonymisation, access controls, expiry, and documented purpose.
- Production: live data, tightly restricted support access, audited break-glass.
- Migration enclave: temporary, access-controlled, encrypted workspace with no third-party analytics/AI and automatic teardown after reconciliation and retention confirmation.

## Architecture decisions still required

Record these as ADRs: identity provider; hosting/database vendor and UK region; tenant/site scoping; offline requirement; event/correction semantics; audit sink; RPO/RTO; incident/radio boundary; export formats/purposes; retention engine; accessibility target and supported devices/browsers.

Confirmed additions: multi-event isolation; capability-based per-person access; aggregate-only dashboards; mixed personal/company devices; offline-first mutation subset; self-hosting preference. Still open: exact host platform, identity provider, RPO/RTO, application-account population, and formal incident-module scope.

Updated decisions: the host is a Contabo VPS running Windows Server 2016; accounts are limited to directors, managers, supervisors, and administrators; access is organisation-wide; and there is no existing identity provider. Continue synthetic development on this basis while retaining the supported-host upgrade as a production lifecycle action.

Do not build authentication primitives from scratch. Evaluate a maintained authentication service/library supporting individual accounts, passkeys/TOTP MFA, secure recovery, session revocation, rate limiting, audit, and administrator lifecycle controls. A self-hosted identity service increases maintenance burden; a managed service requires processor, location, and contract review.

## Incident authorisation model

Use two incident classifications: `General` and `Restricted`. Restricted incidents do not exist from the perspective of an unauthorised account: list, search, count, direct-ID lookup, relationship, notification, export, and offline-sync responses reveal nothing. Require an explicit restricted-incident capability for content access. Enforce this in server queries/services and database access patterns, not with front-end conditional rendering. A direct lookup of a restricted ID returns the same not-found response as a nonexistent record.

Use separate capabilities such as `incident.general.read`, `incident.create`, `incident.update`, `incident.restricted.read`, `incident.restricted.update`, `incident.export`, `incident.restricted.export`, `incident.classification.restrict`, and `incident.classification.unrestrict`. Restricted access is assigned per account and audited. Offline sync must omit restricted content unless the account currently has permission and explicitly pins or receives the case.

Ordinary users see no placeholder and no restricted-case counts. Aggregates shown to them exclude restricted incidents and must be labelled as counts within their permitted view. Users with restricted access may receive combined or separately labelled totals according to reporting permission.

The restrict/unrestrict operations are dedicated server commands, not ordinary field updates. Both require current permission, re-authentication, reason capture, immutable audit, and alerts where configured. No second-person approval is required. The server re-checks permission even if an old or offline client still displays a stale control.

## Incident purge architecture

Implement purge as a privileged, online-only orchestration job, not a simple row delete. It verifies `incident.purge`, fresh MFA, typed confirmation, reason, and absence of holds; locks the incident; revokes offline sync; destroys its wrapped per-incident encryption key; deletes live and derived objects; retries idempotently; and produces a content-free completion/failure manifest.

`incident.purge` is independently assignable per account. Users without it receive no purge control and the server denies direct calls. The purge control routes to a dedicated confirmation page backed by a short-lived, single-use purge-intent token. The GET/page-load path is read-only. Only the final POST/command may delete, after the server rechecks permission, MFA freshness, typed reference, checkbox, reason, token, incident version, and holds. Refresh/replay and double submission are idempotently rejected. One authorised account may execute without a second approver or delay.

Per-incident envelope encryption makes purge effective against immutable backups: deleting the wrapped data key makes residual ciphertext unrecoverable. Keep master keys outside PostgreSQL, restrict key-destruction access, and test that a purged case cannot be restored. Never place plaintext case data in logs, analytics, notifications, filenames, or unencrypted exports.
