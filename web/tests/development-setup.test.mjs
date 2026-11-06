import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("development setup uses local PostgreSQL without Docker", async () => {
  const setup = await readFile(new URL("../scripts/setup-development.mjs", import.meta.url), "utf8");
  assert.match(setup, /127\.0\.0\.1/);
  assert.match(setup, /safer_spaces_dev/);
  assert.match(setup, /findPsql/);
  assert.match(setup, /APP_DATA_MODE", "live"/);
  assert.match(setup, /ssn_schema_migrations/);
  assert.doesNotMatch(setup, /docker/i);
  assert.doesNotMatch(setup, /BOOTSTRAP_ADMIN_PASSWORD.*setEnvValue/);
});

test("development setup keeps database passwords out of command arguments", async () => {
  const setup = await readFile(new URL("../scripts/setup-development.mjs", import.meta.url), "utf8");
  assert.match(setup, /PGPASSWORD: password/);
  assert.doesNotMatch(setup, /["']--password["']/);
});
