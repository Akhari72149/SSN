import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("development setup uses local PostgreSQL without Docker", async () => {
  const setup = await readFile(new URL("../scripts/setup-development.mjs", import.meta.url), "utf8");
  const grants = await readFile(new URL("../scripts/database-grants.mjs", import.meta.url), "utf8");
  assert.match(setup, /127\.0\.0\.1/);
  assert.match(setup, /safer_spaces_dev/);
  assert.match(setup, /findPsql/);
  assert.match(setup, /APP_DATA_MODE", "live"/);
  assert.match(setup, /ssn_schema_migrations/);
  assert.match(grants, /public\.positions/);
  assert.match(setup, /requiredPostgresMajor = 16/);
  assert.match(setup, /show server_version_num/);
  assert.doesNotMatch(setup, /docker/i);
  assert.doesNotMatch(setup, /BOOTSTRAP_ADMIN_PASSWORD.*setEnvValue/);
});

test("database updater applies only pending transactional migrations", async () => {
  const updater = await readFile(new URL("../scripts/update-development-database.mjs", import.meta.url), "utf8");
  const wrapper = await readFile(new URL("../../scripts/update-development-database.ps1", import.meta.url), "utf8");
  assert.match(updater, /ssn_schema_migrations/);
  assert.match(updater, /set local role/);
  assert.match(updater, /lock_timeout/);
  assert.match(updater, /statement_timeout/);
  assert.match(updater, /applicationGrantSql/);
  assert.doesNotMatch(updater, /BOOTSTRAP_ADMIN/);
  assert.match(wrapper, /Read-PlainTextPassword/);
  assert.match(wrapper, /Remove-Item Env:SSN_DATABASE_ADMIN_PASSWORD/);
});

test("version checker validates the running server rather than only the client", async () => {
  const checker = await readFile(new URL("../../scripts/check-postgresql-version.ps1", import.meta.url), "utf8");
  assert.match(checker, /show server_version/);
  assert.match(checker, /show server_version_num/);
  assert.match(checker, /serverMajor -eq 16/);
  assert.match(checker, /PGPASSWORD/);
});

test("development setup keeps database passwords out of command arguments", async () => {
  const setup = await readFile(new URL("../scripts/setup-development.mjs", import.meta.url), "utf8");
  assert.match(setup, /PGPASSWORD: password/);
  assert.doesNotMatch(setup, /["']--password["']/);
});

test("the first administrator enrols MFA through the first-login screen", async () => {
  const bootstrap = await readFile(new URL("../scripts/bootstrap-admin.mjs", import.meta.url), "utf8");
  assert.match(bootstrap, /'active',null,false/);
  assert.match(bootstrap, /MFA will be connected by QR code/);
  assert.doesNotMatch(bootstrap, /insert into mfa_credentials/i);
  assert.doesNotMatch(bootstrap, /Authenticator setup key/);
});

test("development MFA recovery cannot target another database", async () => {
  const reset = await readFile(new URL("../scripts/reset-development-mfa.mjs", import.meta.url), "utf8");
  assert.match(reset, /localHosts/);
  assert.match(reset, /safer_spaces_dev/);
  assert.match(reset, /mfa_enrolled_at = null/);
  assert.match(reset, /auth\.development_mfa_reset/);
  assert.match(reset, /update mfa_recovery_codes set used_at/);
  assert.doesNotMatch(reset, /delete from mfa_recovery_codes/);
});
