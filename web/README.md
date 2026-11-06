# Safer Spaces Operations

Installable event-operations PWA using Next.js, PostgreSQL, Drizzle and synthetic prototype data.

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

## Deployment shape

The app targets the self-hosted Next.js Node runtime so it can connect directly to PostgreSQL on the Windows server. Cloudflare Tunnel should proxy HTTPS traffic to the local application port; PostgreSQL must not be exposed publicly.

The build command prepares `.next/standalone` with its static and public assets. Production should run `pnpm start` under a Windows service account. Keep `DATABASE_URL` and future authentication encryption keys in server environment variables, never source control.

## Secure data foundation

The PostgreSQL schema and append-only migrations cover:

- accounts with mandatory-MFA enrollment state and hashed session/recovery material;
- individual permission grants rather than reusable role templates;
- two-person privileged account recovery with self-reset blocked;
- events and event-specific `SSN-<EventID>-####` staff identifiers;
- paid/volunteer staff, shifts, attendance corrections and non-attendance flags;
- multiple deployments and radio, earpiece, clothing and tracker allocations;
- immutable audit events and queued offline operations.

The browser interface still uses synthetic data. Do not enter live data until authentication and permission middleware is connected. In an approved empty database, apply `drizzle/0000_initial_postgresql.sql`, then `drizzle/0001_secure_foundation.sql`, and seed `db/seeds/permission-definitions.sql`.
