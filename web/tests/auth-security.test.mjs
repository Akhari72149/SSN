import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  decryptSecret,
  encryptSecret,
  generateTemporaryPassword,
  hashPassword,
  hashRecoveryCode,
  verifyPassword,
} from "../lib/auth/crypto.ts";
import { decodeBase32, encodeBase32, totpCode, verifyTotp } from "../lib/auth/totp.ts";
import { isValidUsername, normalizeUsername } from "../lib/auth/username.ts";

process.env.AUTH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

test("passwords use scrypt and reject incorrect values", async () => {
  const encoded = await hashPassword("a-long-unique-test-password");
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyPassword("a-long-unique-test-password", encoded), true);
  assert.equal(await verifyPassword("a-different-test-password", encoded), false);
});

test("temporary passwords are strong and usernames support names with spaces", () => {
  const password = generateTemporaryPassword();
  assert.equal(password.length, 20);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[!@#$%*_-]/);
  assert.equal(normalizeUsername("  Joe   M  "), "joe m");
  assert.equal(isValidUsername("Joe M"), true);
});

test("MFA secrets are encrypted with authenticated encryption", () => {
  const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
  assert.match(encrypted, /^v1\./);
  assert.equal(decryptSecret(encrypted), "JBSWY3DPEHPK3PXP");
  assert.notEqual(hashRecoveryCode("ABCDEF-123456"), hashRecoveryCode("ABCDEF-654321"));
});

test("TOTP matches the RFC 6238 SHA-1 test vector", () => {
  const secretBytes = Buffer.from("12345678901234567890", "ascii");
  const secret = encodeBase32(secretBytes);
  assert.deepEqual(decodeBase32(secret), secretBytes);
  assert.equal(totpCode(secret, 59_000, 30, 8), "94287082");
  const current = totpCode(secret, 1_700_000_000_000);
  assert.equal(verifyTotp(secret, current, 1_700_000_000_000), true);
});

test("session cookies are hardened and write APIs require CSRF", async () => {
  const sessionSource = await readFile(new URL("../lib/auth/session.ts", import.meta.url), "utf8");
  const httpSource = await readFile(new URL("../lib/auth/http.ts", import.meta.url), "utf8");
  assert.match(sessionSource, /httpOnly: true/);
  assert.match(sessionSource, /sameSite: "strict"/);
  assert.match(httpSource, /x-csrf-token/);
  assert.match(httpSource, /Invalid request origin/);
});

test("sign-in uses a normalized username rather than an email address", async () => {
  const loginSource = await readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(loginSource, /userAccounts\.username/);
  assert.doesNotMatch(loginSource, /userAccounts\.email/);
});

test("account recovery requires two people and revokes prior authentication", async () => {
  const recoverySource = await readFile(new URL("../app/api/accounts/[accountId]/route.ts", import.meta.url), "utf8");
  assert.match(recoverySource, /permissions\.accountReset/);
  assert.match(recoverySource, /approvals\.length < 2/);
  assert.match(recoverySource, /mfaCredentials[\s\S]*revokedAt/);
  assert.match(recoverySource, /authSessions[\s\S]*revokedAt/);
  assert.match(recoverySource, /mustChangePassword: true/);
  assert.match(recoverySource, /mfaEnrolledAt: null/);
});

test("account archiving is recoverable and blocks active authentication", async () => {
  const lifecycleSource = await readFile(new URL("../app/api/accounts/[accountId]/route.ts", import.meta.url), "utf8");
  assert.match(lifecycleSource, /action === "archive"/);
  assert.match(lifecycleSource, /status: "disabled", archivedAt: now/);
  assert.match(lifecycleSource, /authSessions[\s\S]*revokedAt/);
  assert.match(lifecycleSource, /action === "restore"/);
  assert.match(lifecycleSource, /archivedAt: null, archivedByUserId: null, archiveReason: null/);
  assert.doesNotMatch(lifecycleSource, /delete\(userAccounts\)/);
});
