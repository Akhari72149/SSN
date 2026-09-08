# Synthetic Prototype Acceptance Checklist

The prototype may progress to controlled pilot planning only when the applicable items below are demonstrated with synthetic data.

## Brand and usability

- [ ] Matches `design-system.md` using provisional local logo and licensed-safe font fallbacks.
- [ ] Responsive and usable on representative phone, tablet and laptop sizes.
- [ ] Priority tasks are understandable to representative less-technical users.
- [ ] Keyboard, focus, zoom/reflow, screen-reader labels and contrast meet WCAG 2.2 AA target.

## Core workflows

- [ ] Multiple events coexist without destructive reset or cross-event corruption.
- [ ] Staff search/profile, 1–14-day and overnight shifts, sign-on/off and breaks work.
- [ ] Kit quantity/size and numbered radio/tracker issue/return/update work.
- [ ] Deployment current state/history and informal radio log work.
- [ ] Aggregate dashboard displays numbers only.

## Incidents

- [ ] General incident create/view/update/history works with synthetic fields.
- [ ] Restricted incident is completely absent without permission, including direct ID, search and counts.
- [ ] Separate restrict/unrestrict permissions and audit work.
- [ ] Individual/bulk export permissions and expiry are demonstrated synthetically.
- [ ] Preservation hold blocks purge.
- [ ] Dedicated purge confirmation page requires permission, fresh auth, reason, typed reference and checkbox.
- [ ] Purge removes live/derived data, distributes tombstone and makes backup-test ciphertext unreadable via key destruction.

## Access and authentication

- [ ] Individual accounts, MFA, secure sessions and recovery journeys work.
- [ ] Every capability has positive and negative API tests.
- [ ] Per-account overrides work independently of role templates.
- [ ] Privilege changes revoke sessions/offline leases as specified.

## Offline

- [ ] Staff, attendance, breaks, equipment, deployment, radio log and authorised incident workflows function offline.
- [ ] UI distinguishes local save from server acceptance.
- [ ] Conflict tests preserve both sides and require safe resolution.
- [ ] Restricted/offline permission expiry, revocation and purge remove local content.
- [ ] Device loss and clock/DST cases pass.

## Security and operations

- [ ] No personal/sensitive data appears in URLs, notifications, telemetry, logs or errors.
- [ ] Secrets, dependencies, input validation, encoding, CSRF, rate limits and security headers are reviewed.
- [ ] PostgreSQL is non-public, encrypted in transit and backed up off-host.
- [ ] Restore test and preliminary incident-response tabletop pass.
- [ ] Windows Server 2016 hosting risk and upgrade ownership are recorded.

## Governance gates before live pilot

- [ ] Approved incident field schema and workflows.
- [ ] Named privacy/security/service/safeguarding owners and deputies.
- [ ] DPIA decision and required privacy/safeguarding/legal review.
- [ ] Approved retention, hold, police disclosure and purge policies.
- [ ] Device/BYOD requirements and offline lease periods.
- [ ] Recovery targets, support/on-call plan and Contabo hardening/backup evidence.
- [ ] Approved migration/reconciliation scope and explicit live-data authorisation.

