# Authentication, Sessions and Recovery

Status: proposed design. No existing workforce identity provider is available.

## Account model

Individual accounts only for directors, managers, supervisors and administrators. Staff/volunteer roster entries are not automatically login accounts. Email/username uniqueness, active/disabled state, named owner and immutable access history.

## Authentication

- Use a maintained authentication component/service; do not implement password hashing, MFA or reset cryptography from scratch.
- Require MFA for every account. Prefer passkeys/WebAuthn, with TOTP as supported fallback.
- If passwords are used: modern provider-managed hashing, breached-password screening, adequate minimum length, password-manager compatibility and rate limiting.
- Recovery codes are one-time, hashed and shown only at enrolment/regeneration.

## Sessions

- Secure, HTTP-only, same-site cookies; CSRF protection and TLS only.
- Rotate on login, MFA, privilege change and recovery.
- Recommended starting point: 30-minute sensitive idle timeout and 12-hour absolute operational session, validated through pilot usability.
- Require fresh authentication for restricted classification changes, exports, holds, privileged permission changes and purge.
- Account disable, capability change, device loss or suspected compromise revokes relevant sessions and offline leases.

## Recovery

User requests recovery through a generic non-disclosing flow. Recovery must not reveal whether an account exists. A director/authorised administrator verifies identity using a documented out-of-band method; no security questions based on discoverable personal data.

Privileged recovery capability is separate from ordinary access management. Recovery invalidates existing sessions, MFA methods as appropriate, recovery codes and offline leases; notifies the user/director; and creates a security audit event. No universal backdoor, shared recovery account or support-visible password.

Whether two directors must approve privileged-account recovery remains a policy choice; the prototype should support an optional dual-control workflow even though incident classification and purge do not require dual approval.

## Initial account bootstrap

Create the first director through a one-time offline/console bootstrap on the server, then disable the bootstrap route. Require immediate MFA and recovery-code setup. Every later account is invited by an authorised access administrator and expires if not accepted promptly.

## Abuse controls

Rate-limit login, MFA, recovery, invitation and re-authentication by account/IP/device signals. Use progressive delays and alerts without allowing an attacker to lock out the whole organisation. Monitor credential stuffing, impossible activity patterns, repeated recovery and privilege changes.

## Hosting

Authentication secrets/keys reside in managed secret/key storage separate from application code and PostgreSQL credentials. Windows Server timezone does not affect tokens; all expiry uses UTC. Administrative server access uses separate credentials and MFA/VPN where available.

## Acceptance tests

- MFA enrolment/login/fallback/recovery and lost device.
- Session fixation, CSRF, cookie/header configuration and revocation.
- Disabled/offboarded user online and offline.
- Permission elevation and stale session/lease.
- Recovery enumeration, abuse limits and audit alerts.
- First-account bootstrap cannot be reused.

