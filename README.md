# Safer Spaces Operations

The installable PWA is in `web/`. It supports a safe demonstration mode and an authenticated local-development mode backed by PostgreSQL.

## Run on Windows

Double-click `run-safer-spaces.cmd` in this folder. The launcher will:

1. create `web/.env.local` from the safe development template when absent;
2. install dependencies when they are absent; and
3. start the development preview.

Open <http://localhost:3000> if it does not open automatically. Press `Ctrl+C` in the launcher window to stop the preview.

For real development testing, install PostgreSQL for Windows and run `setup-development.cmd` once. It creates a separate `safer_spaces_dev` database, applies the migrations, creates the first administrator and changes the ignored local configuration to live mode. Docker is not used.

The app builds for the self-hosted Next.js Node runtime and includes MFA login, server-side sessions, individual permission checks, CSRF protection, audit events, account-recovery controls, and protected event/staff APIs. See `web/README.md` for the ordered database, first-administrator, and live-mode setup steps.
