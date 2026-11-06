export const SESSION_COOKIE = "ssn_session";
export const MFA_CHALLENGE_COOKIE = "ssn_mfa_challenge";
export const CSRF_COOKIE = "ssn_csrf";

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const MFA_CHALLENGE_DURATION_MS = 5 * 60 * 1000;
export const MAX_PASSWORD_FAILURES = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isLiveMode() {
  return process.env.APP_DATA_MODE === "live";
}

export function secureCookies() {
  return process.env.NODE_ENV === "production";
}
