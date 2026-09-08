# Safer Spaces synthetic prototype

The first visual application slice is in `web/` and contains synthetic data only.

## Run on Windows

Double-click `run-safer-spaces.cmd` in this folder. The launcher will:

1. create `web/.env.local` from the safe development template when absent;
2. install dependencies when they are absent; and
3. start the development preview.

Open <http://localhost:3000> if it does not open automatically. Press `Ctrl+C` in the launcher window to stop the preview.

The current visual slice does not query PostgreSQL. `DATABASE_URL` is already configured for the future local PostgreSQL service, and no live data is used.
