import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(scriptDirectory, "..");
const envPath = resolve(webDirectory, ".env.local");
const migrationDirectory = resolve(webDirectory, "drizzle");
const seedPath = resolve(webDirectory, "db", "seeds", "permission-definitions.sql");
const host = "127.0.0.1";
const port = process.env.SSN_DATABASE_PORT || "5432";
const databaseAdmin = process.env.SSN_DATABASE_ADMIN || "postgres";
const databaseAdminPassword = process.env.SSN_DATABASE_ADMIN_PASSWORD || "";
const databaseName = "safer_spaces_dev";
const ownerName = "ssn_owner";
const appName = "ssn_app";
const ownerPassword = randomBytes(24).toString("base64url");
const appPassword = randomBytes(24).toString("base64url");

function findPsql() {
  if (process.env.PSQL_PATH && existsSync(process.env.PSQL_PATH)) return process.env.PSQL_PATH;
  const located = spawnSync("where.exe", ["psql.exe"], { encoding: "utf8" });
  if (located.status === 0) return located.stdout.split(/\r?\n/).find(Boolean);
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const postgresDirectory = resolve(programFiles, "PostgreSQL");
  if (existsSync(postgresDirectory)) {
    const versions = readdirSync(postgresDirectory).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = resolve(postgresDirectory, version, "bin", "psql.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error("PostgreSQL command-line tools were not found. Install PostgreSQL for Windows, including Command Line Tools, then run setup-development.cmd again.");
}

const psqlPath = findPsql();

function psql({ database, user, password, sql = "", arguments: extraArguments = [] }) {
  const result = spawnSync(psqlPath, ["-X", "-h", host, "-p", port, "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", ...extraArguments], {
    cwd: webDirectory,
    encoding: "utf8",
    input: sql,
    env: { ...process.env, PGPASSWORD: password },
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(detail || `PostgreSQL returned exit code ${result.status}`);
  }
  return result.stdout.trim();
}

function adminPsql(database, sql = "", extraArguments = []) {
  return psql({ database, user: databaseAdmin, password: databaseAdminPassword, sql, arguments: extraArguments });
}

function ownerPsql(sql = "", extraArguments = []) {
  return psql({ database: databaseName, user: ownerName, password: ownerPassword, sql, arguments: extraArguments });
}

function setEnvValue(source, key, value) {
  const line = `${key}=${value}`;
  const expression = new RegExp(`^${key}=.*$`, "m");
  if (expression.test(source)) return source.replace(expression, line);
  return `${source.replace(/\s*$/, "")}\n${line}\n`;
}

function readEnvValue(source, key) {
  return source.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";
}

console.log(`Using PostgreSQL at ${host}:${port}.`);
adminPsql("postgres", `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = '${ownerName}') then create role ${ownerName} login; end if;
    if not exists (select 1 from pg_roles where rolname = '${appName}') then create role ${appName} login; end if;
  end $$;
  alter role ${ownerName} password '${ownerPassword}';
  alter role ${appName} password '${appPassword}';
`);

const databaseExists = adminPsql("postgres", "", ["-tAc", `select 1 from pg_database where datname='${databaseName}'`]);
if (databaseExists !== "1") {
  console.log("Creating the isolated safer_spaces_dev database...");
  adminPsql("postgres", `create database ${databaseName} owner ${ownerName};`);
} else {
  adminPsql("postgres", `alter database ${databaseName} owner to ${ownerName};`);
}
adminPsql("postgres", `revoke connect on database ${databaseName} from public; grant connect on database ${databaseName} to ${ownerName}, ${appName};`);

ownerPsql(`
  create table if not exists public.ssn_schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  );
`);

const migrations = readdirSync(migrationDirectory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
for (const filename of migrations) {
  const applied = ownerPsql("", ["-tAc", `select 1 from public.ssn_schema_migrations where filename='${filename}'`]);
  if (applied === "1") {
    console.log(`Already applied ${filename}`);
    continue;
  }
  console.log(`Applying ${filename}...`);
  const migration = readFileSync(resolve(migrationDirectory, filename), "utf8");
  ownerPsql(`begin;\n${migration}\ninsert into public.ssn_schema_migrations(filename) values ('${filename}');\ncommit;\n`);
}

console.log("Refreshing permission definitions...");
ownerPsql(readFileSync(seedPath, "utf8"));
ownerPsql(`
  grant usage on schema public to ${appName};
  grant select on all tables in schema public to ${appName};
  grant insert, update on table
    public.user_accounts,
    public.mfa_credentials,
    public.mfa_recovery_codes,
    public.user_permissions,
    public.auth_sessions,
    public.auth_challenges,
    public.account_recovery_requests,
    public.account_recovery_approvals,
    public.events,
    public.staff,
    public.shifts,
    public.shift_assignments,
    public.attendance_events,
    public.deployments,
    public.equipment_items,
    public.equipment_allocations,
    public.audit_events,
    public.sync_operations
  to ${appName};
  grant delete on table public.auth_challenges to ${appName};
  revoke all on table public.ssn_schema_migrations from ${appName};
  grant usage, select on all sequences in schema public to ${appName};
`);

let envSource = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const encodedPassword = encodeURIComponent(appPassword);
envSource = setEnvValue(envSource, "DATABASE_URL", `postgresql://${appName}:${encodedPassword}@${host}:${port}/${databaseName}`);
envSource = setEnvValue(envSource, "APP_DATA_MODE", "live");
if (!readEnvValue(envSource, "AUTH_ENCRYPTION_KEY")) envSource = setEnvValue(envSource, "AUTH_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
writeFileSync(envPath, envSource.replace(/\r?\n/g, "\r\n"), { encoding: "utf8", mode: 0o600 });

const accountCount = Number(ownerPsql("", ["-tAc", "select count(*) from public.user_accounts"]));
if (accountCount === 0) {
  console.log("Creating the first Safer Spaces administrator...");
  const bootstrap = spawnSync(process.execPath, ["--env-file=.env.local", "scripts/bootstrap-admin.mjs"], { cwd: webDirectory, env: process.env, stdio: "inherit" });
  if (bootstrap.status !== 0) throw new Error("The first administrator could not be created.");
} else {
  console.log(`Administrator bootstrap skipped because ${accountCount} account(s) already exist.`);
}

console.log("\nDevelopment live mode is ready. Restart run-safer-spaces.cmd, then open http://localhost:3000/login.");
console.log(`The isolated development database is ${databaseName} on ${host}:${port}.`);
