# Offline Synchronisation Specification

Status: high-risk prototype requirement. Incident offline behaviour must pass security review before live use.

## Required offline scope

Target nearly all operational workflows: staff list, shifts, sign-on/off, breaks, equipment issue/return, deployment, radio log and incident create/view/update. Purge, access management, exports, classification downgrade and hold release remain online-only. Restricting a case should require online confirmation in the initial version because it changes visibility across users/devices.

## Local storage

- Installable PWA with static application shell.
- Encrypted local database using platform-supported cryptography and a device/account-bound key.
- Store only the minimum active-event staff/shift/equipment context.
- Incident content requires `incident.offline`, relevant read permission and explicit assignment/pinning; never sync the historical incident set automatically.
- Restricted cases require both restricted-read and offline permissions.
- No content in unencrypted web storage, URLs, service-worker logs, crash reports or notification payloads.

Browser storage encryption cannot fully defend against a compromised/unlocked device. Personal-device eligibility therefore requires supported OS/browser, device encryption, screen lock and application lock; otherwise incident offline access is disabled.

## Operation envelope

Every queued command contains operation UUID, device/user/event, target UUID, base version, command type, encrypted payload, device occurrence time/offset/timezone, local sequence and client version. The server records receipt time, checks permissions/lease/version/state and returns accepted, duplicate, conflict, rejected or expired.

## Offline lease

After online MFA, issue a short-lived signed offline-authorisation lease listing allowed capabilities/classifications and expiry. Recommended prototype: ordinary operations up to 24 hours; incident content materially shorter and configurable. Expiry allows viewing only if policy permits, but blocks further sensitive changes until reconnection/re-authentication.

## Conflict rules

- Append-only attendance/break/radio events: accept idempotently, flag impossible sequences.
- Numbered radio/tracker allocation: never silently double-allocate; supervisor conflict queue.
- Quantity kit: merge additive events, validate outstanding quantity.
- Deployment: show competing assignments and require authorised selection; keep both histories.
- Incident: field/revision conflict review; never last-write-wins for narratives, status, welfare, classification or contacts.
- Permission denial/record restriction: reject content mutation, remove unauthorised local copy and retain only content-free sync evidence.

## Device loss/revocation

Revoke session/device and offline lease centrally. At next contact the app destroys local keys/data and syncs tombstones. Short leases/local expiry limit disconnected exposure. Provide a director runbook for lost personal/company devices.

## Purge propagation

Purge is online-only. The server records a tombstone that causes every authorised device to delete the local incident and key material before accepting later operations. Queued changes to a purged incident are rejected without revealing content.

## User experience

Persistent connectivity/sync indicator; per-action state; queue count; last successful sync; expiring access warning; conflict centre; safe retry; clear distinction between local save and server acceptance. Never show an ordinary success toast for a queued action.

## Prototype tests

- Airplane-mode journeys for every required workflow.
- App/browser restart while queued.
- Two devices allocating the same radio and editing the same incident.
- Permission revoked/restricted/purged while device is offline.
- Lost-device revocation and local expiry.
- Clock skew, GMT/BST transition and overnight shifts.
- Storage quota, corrupt queue, partial sync and server outage recovery.

