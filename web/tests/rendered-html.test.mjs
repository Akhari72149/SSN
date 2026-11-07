import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

const port = 32_000 + (process.pid % 1_000);
const origin = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, [".next/standalone/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, APP_DATA_MODE: "synthetic", PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Standalone server did not become ready");
});

after(() => server?.kill());

test("renders the synthetic operations dashboard", async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Safer Spaces Operations<\/title>/i);
  assert.match(html, /Synthetic prototype/);
  assert.match(html, /Today’s team/);
  assert.match(html, /Install on this device/);
  assert.match(html, /Paid/);
  assert.match(html, /Volunteer/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /No live or personal data/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("renders the secure sign-in surface", async () => {
  const response = await fetch(`${origin}/login`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Sign in/);
  assert.match(html, /Username/);
  assert.match(html, /verification code is required/i);
  assert.match(html, /Authentication is disabled while the application is in synthetic mode/);
});

test("renders the first-login password and MFA setup surface", async () => {
  const response = await fetch(`${origin}/login/setup?password=1`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Secure your account/);
  assert.match(html, /Change password/);
});

test("the first-login client includes local QR enrolment", async () => {
  const setup = await readFile(new URL("../app/login/setup/setup-form.tsx", import.meta.url), "utf8");
  assert.match(setup, /Authenticator setup QR code/);
  assert.match(setup, /qrcode-generator\.mjs/);
  assert.match(setup, /Can’t scan the QR code/);
  assert.doesNotMatch(setup, /api\.qrserver|chart\.googleapis/);
});

test("operation forms keep their form reference across asynchronous submissions", async () => {
  const manager = await readFile(new URL("../app/operations-manager.tsx", import.meta.url), "utf8");
  assert.match(manager, /const form = event\.currentTarget;/);
  assert.match(manager, /await api[\s\S]*form\.reset\(\)/);
  assert.doesNotMatch(manager, /await api[\s\S]*event\.currentTarget\.reset\(\)/);
});

test("equipment has its own page and only radios request an item code", async () => {
  const dashboard = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
  const manager = await readFile(new URL("../app/operations-manager.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/events/[eventId]/equipment/route.ts", import.meta.url), "utf8");
  assert.match(dashboard, /"Operations", "Equipment", "Incidents"/);
  assert.match(manager, /section === "Equipment"/);
  assert.match(manager, /equipmentType === "radio"[\s\S]*Radio item code/);
  assert.match(route, /type === "radio" \? requestedItemCode : `internal-/);
});

test("shift planning provides position-based Gantt views and person search", async () => {
  const dashboard = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
  const planner = await readFile(new URL("../app/shift-planner.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/events/[eventId]/shifts/route.ts", import.meta.url), "utf8");
  assert.match(dashboard, /"Staff", "Shifts", "Operations"/);
  assert.match(planner, /Gantt schedule/);
  for (const view of ["One day", "Entire event", "Date range", "Search person"]) assert.match(planner, new RegExp(view));
  assert.match(planner, /create_position/);
  assert.match(planner, /positionId/);
  assert.match(planner, /form-modal-backdrop/);
  assert.match(planner, /Number of shifts/);
  assert.match(planner, /scheduling database update is not installed/i);
  assert.match(route, /innerJoin\(staff/);
  assert.match(route, /shift\.assignments\.some/);
  assert.match(route, /length: quantity/);
  assert.match(route, /batchQuantity: quantity/);
});

test("keeps authentication and live-data APIs closed in synthetic mode", async () => {
  const loginResponse = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "example", password: "not-a-password" }),
  });
  assert.equal(loginResponse.status, 409);

  const eventsResponse = await fetch(`${origin}/api/events`);
  assert.equal(eventsResponse.status, 409);
  assert.equal((await fetch(`${origin}/api/accounts`)).status, 409);
  assert.equal((await fetch(`${origin}/api/auth/first-login`, { method: "POST" })).status, 409);

  for (const resource of ["staff", "shifts", "attendance", "deployments", "equipment"]) {
    const response = await fetch(`${origin}/api/events/00000000-0000-0000-0000-000000000000/${resource}`);
    assert.equal(response.status, 409, `${resource} must remain closed outside live mode`);
  }
});

test("provides an installable standalone manifest", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.name, "Safer Spaces Operations");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.purpose.includes("maskable")));
});

test("offline worker caches only the application shell", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /offline\.html/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.doesNotMatch(worker, /caches\.put\([^\n]*api\//);
});
