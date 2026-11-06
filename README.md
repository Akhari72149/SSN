# Safer Spaces Operations

The installable PWA is in `web/`. It uses safe synthetic data by default and now includes an opt-in, authenticated PostgreSQL live mode.

## Run on Windows

Double-click `run-safer-spaces.cmd` in this folder. The launcher will:

1. create `web/.env.local` from the safe development template when absent;
2. install dependencies when they are absent; and
3. start the development preview.

Open <http://localhost:3000> if it does not open automatically. Press `Ctrl+C` in the launcher window to stop the preview.

The app builds for the self-hosted Next.js Node runtime and includes MFA login, server-side sessions, individual permission checks, CSRF protection, audit events, account-recovery controls, and protected event/staff APIs. See `web/README.md` for the ordered database, first-administrator, and live-mode setup steps.
