# Safer Spaces Operations

Installable event-operations PWA using Next.js, PostgreSQL and Drizzle. It runs with synthetic data by default and switches to authenticated database-backed mode only when explicitly enabled.

## Requirements

- Node.js 22.13 or later
- pnpm
- PostgreSQL for server-side data work

## Local development

```bash
pnpm install
pnpm dev
```

The repository launcher creates `.env.local` from `.env.example` when needed. Open <http://localhost:3000>.

## Commands

- `pnpm dev` — start the local Next.js server
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

Leave `APP_DATA_MODE=synthetic` in local development. To prepare a new live installation:

1. Create a PostgreSQL database that is reachable only from the application server.
2. Set `DATABASE_URL` and a random 32-byte base64 `AUTH_ENCRYPTION_KEY` in the Windows service environment.
3. Apply `drizzle/0000_initial_postgresql.sql`, `drizzle/0001_secure_foundation.sql`, and `drizzle/0002_authentication_runtime.sql` in order, then apply `db/seeds/permission-definitions.sql`.
4. Set the one-time `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` values and run `pnpm admin:bootstrap` from `web/`.
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
