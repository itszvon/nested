#!/usr/bin/env node
/**
 * Post-deploy smoke test. Runs against production by default; override with
 * SMOKE_BASE_URL=http://localhost:3000.
 *
 * Exit code 1 on any failed check, so a deploy pipeline can gate on it.
 */

const base = (process.env.SMOKE_BASE_URL ?? "https://nestedforyou.vercel.app").replace(/\/$/, "");

const checks = [
  { name: "landing", path: "/home", status: 200 },
  { name: "login", path: "/login", status: 200 },
  { name: "app is gated", path: "/app", status: 307 },
  { name: "health", path: "/api/health", status: 200 },
  { name: "robots", path: "/robots.txt", status: 200 },
  { name: "sitemap", path: "/sitemap.xml", status: 200 },
  { name: "security policy", path: "/security", status: 200 },
  { name: "terms", path: "/terms", status: 200 },
  { name: "privacy", path: "/privacy", status: 200 },
  {
    name: "download requires a session",
    path: "/api/files/00000000-0000-0000-0000-000000000000/download",
    status: 401,
  },
];

let failures = 0;

async function run() {
  for (const check of checks) {
    const url = `${base}${check.path}`;
    try {
      const response = await fetch(url, { redirect: "manual" });
      const ok = response.status === check.status;
      if (!ok) failures += 1;
      console.log(`${ok ? "PASS" : "FAIL"}  ${check.name}  ${response.status} (expected ${check.status})`);
    } catch (error) {
      failures += 1;
      console.log(`FAIL  ${check.name}  ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Health must actually report a healthy database, not just 200.
  try {
    const response = await fetch(`${base}/api/health`);
    const body = await response.json();
    const ok = body?.ok === true;
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  health reports ok=true`);
  } catch {
    failures += 1;
    console.log("FAIL  health body could not be read");
  }

  // The landing page must carry sharing metadata.
  try {
    const html = await (await fetch(`${base}/home`)).text();
    const ok = html.includes('property="og:title"') && html.includes('rel="canonical"');
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  landing has og:title and canonical`);
  } catch {
    failures += 1;
    console.log("FAIL  landing metadata could not be read");
  }

  console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} smoke check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

await run();
