import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("renders the synthetic operations dashboard",async()=>{const html=await readFile(new URL("../.next/server/app/index.html",import.meta.url),"utf8");assert.match(html,/<title>Safer Spaces Operations<\/title>/i);assert.match(html,/Synthetic prototype/);assert.match(html,/Today’s team/);assert.match(html,/Install on this device/);assert.match(html,/Paid/);assert.match(html,/Volunteer/);assert.match(html,/manifest\.webmanifest/);assert.match(html,/No live or personal data/);assert.doesNotMatch(html,/codex-preview/)});

test("provides an installable standalone manifest",async()=>{const manifest=JSON.parse(await readFile(new URL("../public/manifest.webmanifest",import.meta.url),"utf8"));assert.equal(manifest.name,"Safer Spaces Operations");assert.equal(manifest.display,"standalone");assert.equal(manifest.start_url,"/");assert.ok(manifest.icons.some((icon)=>icon.purpose.includes("maskable")))});

test("offline worker caches only the application shell",async()=>{const worker=await readFile(new URL("../public/sw.js",import.meta.url),"utf8");assert.match(worker,/offline\.html/);assert.match(worker,/request\.mode === "navigate"/);assert.doesNotMatch(worker,/caches\.put\([^\n]*api\//)});
