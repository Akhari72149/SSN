const USERNAME_PATTERN = /^[a-z][a-z0-9._-]*(?: [a-z0-9][a-z0-9._-]*)*$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isValidUsername(value: string) {
  const normalized = normalizeUsername(value);
  return normalized.length >= 3 && normalized.length <= 50 && USERNAME_PATTERN.test(normalized);
}
