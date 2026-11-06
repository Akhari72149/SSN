import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../drizzle/0001_secure_foundation.sql", import.meta.url);
const authMigrationUrl = new URL("../drizzle/0002_authentication_runtime.sql", import.meta.url);
const usernameMigrationUrl = new URL("../drizzle/0003_username_authentication.sql", import.meta.url);
const firstLoginMigrationUrl = new URL("../drizzle/0004_first_login_accounts.sql", import.meta.url);

test("secure foundation migration contains the agreed operational domains", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of [
    "user_accounts",
    "mfa_credentials",
    "user_permissions",
    "account_recovery_requests",
    "deployments",
    "equipment_items",
    "equipment_allocations",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}\\b`, "i"));
  }
});

test("authentication material is stored as hashes or ciphertext", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const authSql = await readFile(authMigrationUrl, "utf8");
  assert.match(sql, /password_hash text/i);
  assert.match(sql, /token_hash text NOT NULL/i);
  assert.match(sql, /secret_ciphertext text/i);
  assert.match(authSql, /CREATE TABLE "auth_challenges"/i);
  assert.match(authSql, /csrf_token_hash/i);
  assert.doesNotMatch(sql, /password text[,\n]/i);
  assert.doesNotMatch(sql, /session_token text/i);
});

test("database constraints prevent self-reset and double equipment allocation", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /account_recovery_no_self_reset/i);
  assert.match(sql, /equipment_active_allocation_unique[\s\S]*WHERE returned_at IS NULL/i);
  assert.match(sql, /staff_event_number_unique/i);
});

test("username authentication migration safely backfills existing accounts", async () => {
  const sql = await readFile(usernameMigrationUrl, "utf8");
  assert.match(sql, /ADD COLUMN "username" text;/i);
  assert.match(sql, /UPDATE "user_accounts" SET "username"/i);
  assert.match(sql, /ALTER COLUMN "username" SET NOT NULL/i);
  assert.match(sql, /user_account_username_unique/i);
});

test("new accounts must replace temporary passwords without changing existing accounts", async () => {
  const sql = await readFile(firstLoginMigrationUrl, "utf8");
  assert.match(sql, /auth_challenge_purpose/i);
  assert.match(sql, /must_change_password" boolean DEFAULT false NOT NULL/i);
  assert.match(sql, /must_change_password" SET DEFAULT true/i);
});

test("database access remains server-side and health failures do not leak details", async () => {
  const dbSource = await readFile(new URL("../db/index.ts", import.meta.url), "utf8");
  const healthSource = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(dbSource, /PostgreSQL client is server-only/);
  assert.match(healthSource, /runtime = "nodejs"/);
  assert.match(healthSource, /database: "unavailable"/);
  assert.doesNotMatch(healthSource, /error\.message|String\(error\)/);
});
