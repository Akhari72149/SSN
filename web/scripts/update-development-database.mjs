import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { applicationGrantSql } from "./database-grants.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(scriptDirectory, "..");
const migrationDirectory = resolve(webDirectory, "drizzle");
const seedPath = resolve(webDirectory, "db", "seeds", "permission-definitions.sql");
const host = "127.0.0.1";
const port = process.env.SSN_DATABASE_PORT || "5432";
const databaseAdmin = process.env.SSN_DATABASE_ADMIN || "postgres";
const databaseAdminPassword = process.env.SSN_DATABASE_ADMIN_PASSWORD || "";
const databaseName = "safer_spaces_dev";
const ownerName = "ssn_owner";
const appName = "ssn_app";

if (!databaseAdminPassword) throw new Error("The PostgreSQL administrator password is required");

function findPsql() {
  if (process.env.PSQL_PATH && existsSync(process.env.PSQL_PATH)) return process.env.PSQL_PATH;
  const located = spawnSync("where.exe", ["psql.exe"], { encoding: "utf8" });
  if (located.status === 0) return located.stdout.split(/\r?\n/).find(Boolean);
  const postgresDirectory = resolve(process.env.ProgramFiles || "C:\\Program Files", "PostgreSQL");
  if (existsSync(postgresDirectory)) {
    const versions = readdirSync(postgresDirectory).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = resolve(postgresDirectory, version, "bin", "psql.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error("PostgreSQL command-line tools were not found");
}

const psqlPath = findPsql();
function adminPsql(database, sql = "", extraArguments = []) {
  const result = spawnSync(psqlPath, ["-X", "-h", host, "-p", port, "-U", databaseAdmin, "-d", database, "-v", "ON_ERROR_STOP=1", ...extraArguments], {
    cwd: webDirectory,
    encoding: "utf8",
    input: sql,
    env: { ...process.env, PGPASSWORD: databaseAdminPassword },
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `PostgreSQL returned exit code ${result.status}`).trim());
  return result.stdout.trim();
}

const serverVersionNumber = Number(adminPsql("postgres", "", ["-tAc", "show server_version_num"]));
if (Math.trunc(serverVersionNumber / 10_000) !== 16) throw new Error("PostgreSQL 16 is required");
const databaseExists = adminPsql("postgres", "", ["-tAc", `select 1 from pg_database where datname='${databaseName}'`]);
if (databaseExists !== "1") throw new Error("The Safer Spaces development database does not exist. Run setup-development.cmd once first.");
const rolesReady = adminPsql("postgres", "", ["-tAc", `select count(*) from pg_roles where rolname in ('${ownerName}','${appName}')`]);
if (rolesReady !== "2") throw new Error("The Safer Spaces database roles are incomplete. Run setup-development.cmd once first.");
const migrationTable = adminPsql(databaseName, "", ["-tAc", "select to_regclass('public.ssn_schema_migrations') is not null"]);
if (migrationTable !== "t") throw new Error("Migration history is missing. Run setup-development.cmd once first.");

const migrations = readdirSync(migrationDirectory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
let appliedCount = 0;
for (const filename of migrations) {
  const applied = adminPsql(databaseName, "", ["-tAc", `select 1 from public.ssn_schema_migrations where filename='${filename}'`]);
  if (applied === "1") { console.log(`Already applied ${filename}`); continue; }
  console.log(`Applying ${filename}...`);
  const migration = readFileSync(resolve(migrationDirectory, filename), "utf8");
  adminPsql(databaseName, `begin;\nset local role ${ownerName};\nset local lock_timeout='5s';\nset local statement_timeout='60s';\n${migration}\ninsert into public.ssn_schema_migrations(filename) values ('${filename}');\ncommit;\n`);
  appliedCount += 1;
}

adminPsql(databaseName, `begin;\nset local role ${ownerName};\n${readFileSync(seedPath, "utf8")}\ncommit;\n`);
adminPsql(databaseName, applicationGrantSql(appName));
console.log(appliedCount ? `\nApplied ${appliedCount} database update(s).` : "\nThe database is already up to date.");
console.log("Restart Safer Spaces to use the current database schema.");
