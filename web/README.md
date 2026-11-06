# Safer Spaces Operations

Installable event-operations PWA using Next.js, PostgreSQL and Drizzle. It runs with synthetic data by default and switches to authenticated database-backed mode only when explicitly enabled.

## Requirements

- Node.js 22.13 or later
- pnpm
- PostgreSQL 16 for live local development and server parity (Docker is not required)

## Local development with real authentication and data

Install PostgreSQL 16 for Windows and include its Command Line Tools. During installation, keep the default port `5432` unless it is already in use and remember the password chosen for the PostgreSQL `postgres` administrator. Double-click `check-postgresql-version.cmd` at any time to list installed clients and verify the version of the running server; the setup refuses to continue unless the running server is PostgreSQL 16.

From the repository root, double-click `setup-development.cmd`. The setup asks for:

- the PostgreSQL administrator username, normally `postgres`;
- the PostgreSQL port, normally `5432`;
- the PostgreSQL administrator password; and
- the first Safer Spaces administrator username, display name and password.

The setup then creates an isolated `safer_spaces_dev` database and separate least-privilege application login, applies every unapplied migration in order, refreshes the permission definitions, creates the first administrator when needed, generates the authentication encryption key and writes the ignored `.env.local` file with `APP_DATA_MODE=live`. It displays the administrator's authenticator setup key and recovery codes once; save both before closing the window.

The database administrator password and Safer Spaces administrator password are kept in process memory only and are removed when setup finishes. They are not written to the repository or `.env.local`.

After setup, double-click `run-safer-spaces.cmd` and open <http://localhost:3000/login>. Re-running setup is safe: applied migrations are tracked and the administrator bootstrap is skipped once an account exists.

For demonstration-only development without PostgreSQL:

```bash
pnpm install
pnpm dev
```

The repository launcher creates `.env.local` from `.env.example` when needed. Open <http://localhost:3000>.

## Commands

- `pnpm dev` — start the local Next.js server
- `pnpm dev:setup` — configure the local PostgreSQL development database and live mode
- `pnpm build` — produce the self-hosted standalone build
- `pnpm start` — run a production build
- `pnpm test` — build and run application, PWA, domain and database tests
- `pnpm lint` — run source checks
- `pnpm db:generate` — generate the next Drizzle migration after a schema change
- `pnpm admin:bootstrap` — create the first administrator after the database and secrets are configured

## Deployment shape

The app targets the self-hosted Next.js Node runtime so it can connect directly to PostgreSQL on the Windows server. Cloudflare Tunnel should proxy HTTPS traffic to the local application port; PostgreSQL must not be exposed publicly.

The build command prepares `.next/standalone` with its static and public assets. Production should run `pnpm start` under a Windows service account. Keep `DATABASE_URL` and future authentication encryption keys in server environment variables, never source control.

## Secure live mode

The automated development setup above is for this computer only. To prepare a production installation:

1. Create a PostgreSQL database that is reachable only from the application server.
2. Set `DATABASE_URL` and a random 32-byte base64 `AUTH_ENCRYPTION_KEY` in the Windows service environment.
3. Apply `drizzle/0000_initial_postgresql.sql` through `drizzle/0004_first_login_accounts.sql` in numeric order, then apply `db/seeds/permission-definitions.sql`.
4. Set the one-time `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD` values. `BOOTSTRAP_ADMIN_EMAIL` is optional and is not used for sign-in. Run `pnpm admin:bootstrap` from `web/`.
5. Save the displayed MFA setup URI and recovery codes securely. Remove the bootstrap password from the environment immediately afterward.
6. Set `APP_DATA_MODE=live`, build, and restart the service behind HTTPS through Cloudflare Tunnel.

The bootstrap command refuses to run once any account exists. Login requires password plus MFA, sessions are stored server-side, mutating requests require a matching origin and CSRF token, and permissions are assigned individually.

## Secure data foundation

The PostgreSQL schema and append-only migrations cover:

- accounts with mandatory-MFA enrollment state and hashed session/recovery material;
- individual permission grants rather than reusable role templates;
- two-person privileged account recovery with self-reset blocked;
- events and event-specific `SSN-<EventID>-####` staff identifiers;
- paid/volunteer staff, shifts, attendance corrections and non-attendance flags;
- multiple deployments and radio, earpiece, clothing and tracker allocations;
- immutable audit events and queued offline operations.

In synthetic mode the browser uses demonstration records only. In live mode the dashboard loads its event and staff lists exclusively through authenticated, permission-checked APIs; it does not fall back to demonstration people if live data cannot be loaded.

The demonstration launcher exposes the Staff, Operations, Incidents and More sections with synthetic records so the interface can be reviewed before a database is connected. Demonstration submissions never call the protected write APIs and are not saved.

## Operational workflows

In live mode, the navigation exposes permission-protected screens for:

- creating events with their generated event code;
- creating individual user accounts with generated temporary passwords and permissions;
- adding paid or volunteer staff with separate legal and preferred names;
- creating shifts and assigning multiple staff;
- recording sign-on, sign-off and non-attendance;
- starting and completing deployments; and
- adding, issuing and returning radios, earpieces, clothing, trackers and other kit.

Every write requires the matching individual permission, a valid authenticated session and CSRF token, and writes an audit event. Incident/disclosure entry remains intentionally disabled until the outstanding retention and restricted-access decisions are approved.

New user accounts are created in an invited state. Their temporary password is displayed to the administrator once, must be replaced on first sign-in, and is followed immediately by mandatory authenticator setup and one-time recovery codes.
