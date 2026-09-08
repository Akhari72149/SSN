# Phased Delivery Plan

The plan deliberately delays live-data handling and production commitments until purpose, access, retention, security, and failure behaviour are approved.

## Phase 0 — Governance and discovery

**Work:** stakeholder/process walkthroughs; data inventory; purpose and lawful-basis assessment; role/scope workshops; connectivity/device survey; current Sheets architecture inventory; DPIA screening; retention and incident/radio decisions; service ownership and budget.

**Outputs:** approved requirements, workflow diagrams, field catalogue, RBAC matrix, retention draft, DPIA decision, migration inventory, architecture decision record, risk register.

**Exit:** accountable owner confirms scope and the privacy/security lead approves progression. No live data accessed.

## Phase 1 — Synthetic prototype

**Work:** clickable and then working thin slice for shift view, sign-on/off, asset issue/return, current deployment, and lookup; all identities/events synthetic. Test mobile, shared-screen, accessibility, correction, conflict, and outage journeys.

Apply and validate the brand system in `design-system.md`, including official logo assets, website-derived colour tokens, typography licensing, accessible operational type, and director review on phone, tablet, and laptop layouts.

**Outputs:** prototype, synthetic seed set, usability findings, revised requirements, measurable workflow timings.

**Exit:** representative users can complete priority tasks; no severe accessibility/usability issue; offline decision supported by evidence.

## Phase 2 — Production foundation and security review

**Work:** managed identity/MFA, scoped RBAC, append-only events/corrections, audit, secrets, environments, CI security checks, encryption, backups/restore, retention engine, monitoring, export controls, incident runbooks. Implement incident/radio only if its scope and policy are approved.

**Outputs:** production-candidate architecture, threat model update, DPIA/security documentation, test evidence, operational runbooks, supplier assessment.

**Exit:** security acceptance criteria met; independent review findings resolved/risk-owned; restore and incident tabletop pass.

## Phase 3 — Controlled pilot

**Work:** explicitly authorised minimum live data for a small cohort/operation; trained users; daily reconciliation; support coverage; measured errors, performance, adoption, access anomalies, and incidents.

**Outputs:** pilot report, access review, reconciliation evidence, updated runbooks/training, go/no-go recommendation.

**Exit:** agreed success thresholds met across multiple representative operations; no unresolved high security/privacy risk; rollback remains viable.

## Phase 4 — Migration and production rollout

**Work:** execute `migration-plan.md`; staged team/site rollout; final reconciliation and acceptance; read-only Sheets transition; enhanced monitoring and support.

**Outputs:** signed migration reconciliation, cutover record, production service, archived/decommissioned source decision.

**Exit:** data owner, operations owner, security/privacy lead, and service owner approve completion.

## Phase 5 — Stabilisation and continuous assurance

**Work:** 2–4 week hypercare; audit access and export patterns; fix priority defects; test retention; tune workflows; confirm temporary data deletion. Then quarterly access reviews, dependency/patch management, periodic restore and incident exercises, annual retention/DPIA review, and independent security testing after material change.

**Outputs:** closure report, residual risk register, service roadmap, assurance calendar.

## Suggested MVP boundary

Include staff lookup (minimal directory), shift plans, attendance events/corrections, asset issue/return/update, current deployments, constrained dashboards, controlled lists, role administration, audit, and safe closure/archive.

Defer detailed incident management, radio-log evidential workflows, welfare/special-category records, continuous tracking, broad offline replication, automated performance decisions, public integrations, and bulk self-service exports until separately justified and reviewed.

## Delivery measures

- Median completion time and error rate for priority workflows.
- Accessibility task success with keyboard, zoom, and representative assistive technology.
- Authorisation negative-test pass rate (target 100%).
- Reconciliation accuracy and unresolved exception count.
- Restore success against approved RPO/RTO.
- Time to revoke a compromised/offboarded account.
- High/critical security findings (target zero open at production).
- Support volume, failed sync/action rate, and operational fallback use.
