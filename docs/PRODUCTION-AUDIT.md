# Production-readiness audit

> **Re-audited 2026-11-11 after the landing redesign:** see
> [PRODUCTION-AUDIT-2026-11-11.md](PRODUCTION-AUDIT-2026-11-11.md). Result:
> READY, no open P0/P1 findings. The two accessibility regressions introduced by
> the redesign were fixed in `e0fd2d8`.

Audit of `https://nestedforyou.vercel.app` against the *Complete Website
Production-Readiness Master Checklist v2.1* (October 2026). Date: 2026-11-01.

**Scope and limits.** Live HTTP checks, repository inspection, database
inspection, and the existing operational documents. No screen-reader session, no
real-device mobile pass, and no load or penetration testing — those are marked
BLOCKED, not PASS.

**Final gate: NOT READY.** Nothing is actively broken or compromised, but three
P1 items (backups, tested restore, alerting/error reporting) fail the
checklist's own gate: *"Do not label a site production-ready while unresolved
P0/P1 risks remain."*

## Section results

| # | Section | Status | Why |
|---|---|---|---|
| 1 | Legal, copyright, content | **PASS** | `/terms`, `/privacy`, `/security`, `/dmca`, `/copyright` all 200; operator and support contact published in `site.ts`; no fabricated claims or testimonials; no UGC, so moderation rules are not applicable. |
| 2 | Design, UX, responsive, accessibility | **PASS (automated)** | Dark-only is a recorded decision; no cookie banner needed; FAQ, back-to-top, copy-to-clipboard present; contrast tokens pass 4.5:1. Lighthouse accessibility **100** on `/home`, `/login` and `/security` (login's raw Tailwind greys were the last failure). A manual screen-reader/device pass is still recommended, not required. |
| 3 | SEO, discovery, sharing | **PASS** | Open Graph, Twitter card, canonical, JSON-LD and a 1200×630 image are live; `robots.txt` allows public pages and blocks private routes; the global `noindex` bug is fixed; Search Console property verified and the sitemap submitted (status Success). |
| 4 | Security and infrastructure | **PARTIAL** | Strong headers, RLS verified, least-privilege keys, kill switch for the runner. No status page; 5 moderate dependency advisories. |
| 5 | E-commerce and payments | **NOT APPLICABLE** | No products, cart, checkout or payments. |
| 6 | Backend, database, data integrity | **PASS** | Daily self-verifying backup to private Storage, restore drill executed and matched row-for-row, trash purged by `pg_cron`, unique indexes and revision checks prevent duplicates. |
| 7 | Quality assurance and testing | **PARTIAL** | CI runs typecheck, lint, build and 18 unit tests; smoke suite covers critical routes live; email confirmation verified end-to-end. Remaining: mobile-browser and offline testing, and a recorded manual a11y pass. |
| 8 | Deployment and release management | **PASS** | Deploys from `master`, production env separated from local, CI gate on every push, smoke suite plus daily smoke workflow, uptime workflow, Vercel instant rollback documented. Migrations are forward-only by design and documented. |
| 9 | Analytics, metrics, reporting | **NOT APPLICABLE (decision)** | No analytics by design: single operator, privacy-first, no cookies beyond the auth session. Recorded as a decision rather than an omission; revisit if the user base grows. |
| 10 | AI / LLM / agent security | **NOT APPLICABLE** | No LLM features. The runner executes user code in a sandboxed worker with network disabled, which is a different threat model and is covered in §4. |
| 11 | Logging, monitoring, incident response | **PARTIAL** | First-party error log (`error_events`) with a Settings view, 15-minute uptime workflow that emails on failure, and a runbook with restore steps. No SLOs, structured trace IDs or third-party alerting. |

## Findings

| ID | Area | Priority | Observation | Recommendation |
|---|---|---|---|---|
| PROD-001 | Backups | **P1** | Supabase free tier has no vendor backups; none are taken elsewhere. | Nightly `pg_dump` to private storage, 30-day retention, credentials outside the repo. |
| PROD-002 | Recovery | **P1** | No restore has ever been performed, so backup viability is unproven. | Restore into a scratch project, time it, write the runbook. |
| PROD-003 | Monitoring | **P1** | Sentry DSNs absent (not in `.env.local`, not in Vercel env); failures are invisible. | Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`, send a test error, confirm delivery. |
| PROD-004 | Monitoring | **P1** | `/api/health` is polled by a Vercel cron but nobody is alerted when it fails. | Free uptime monitor with email/SMS escalation. |
| PROD-005 | Data lifecycle | **P2** | `purge_trash` is revoked from `authenticated` and never scheduled, so trashed rows and their bytes stay forever. | Daily cron (service role) calling `purge_trash(30)`; report reclaimed bytes. |
| PROD-006 | Accessibility | **P2** | `--color-ink-faint` (#6a706b) is 3.87:1 on ground and 3.74:1 on panel — below 4.5:1 for the 9–10px labels it is used for. `--color-accent` (#a8442f) as text is 3.3:1. | Lighten ink-faint and use a lighter accent for text, or reserve both for large text and borders only. |
| PROD-007 | Accessibility | **PASS (2026-11-01)** | Keyboard-only pass completed by the owner: Tab reaches every control, focus is visible, the tree walks with arrows, Ctrl+K works, dialogs keep focus and Esc closes. Lighthouse accessibility 100 on all public pages. Screen-reader/device pass remains optional. | Recorded; repeat if the shell changes substantially. |
| PROD-008 | SEO | **P2** | No OG/Twitter tags, canonical links or JSON-LD; a shared link renders as a bare title. | Add `metadataBase`, `openGraph`, `twitter`, and a canonical per page; one static OG image. |
| PROD-009 | SEO | **P2** | `robots.txt` ends with `Disallow: /`, so general crawlers may fetch only `/home`, while the sitemap lists `/security`, `/dmca`, `/copyright`. | Decide the policy: allow the public pages, keep `/app`, `/login`, `/auth`, `/api` disallowed. |
| PROD-010 | Search Console | **PASS (2026-11-01)** | Property verified with the HTML tag; `sitemap.xml` submitted and accepted. | Monitor the Pages report weekly for the first month. |
| PROD-011 | Code quality | **P2** | `npm run lint` fails: 21 errors (setState-in-effect in dialogs, unescaped entities on legal pages). | Fix them so lint is a real gate in CI. |
| PROD-012 | Testing | **P2** | No automated tests at all. | Start with pure modules: tree assembly, whitespace, copy naming, diff rows, export paths. |
| PROD-013 | Supply chain | **P2** | `npm audit --omit=dev`: 5 moderate advisories. | Review and upgrade where non-breaking; track the rest. |
| PROD-014 | Email | **ACCEPTED (2026-11-01)** | Sender is a Brevo-rewritten Gmail address (`pothole3000@….brevosend.com`); no SPF/DKIM on a product domain. Owner accepted the limitation rather than buying a domain. | Revisit if a domain is purchased; SPF/DKIM work is then a 30-minute change. |
| PROD-015 | Ops docs | **P2** | No incident-response, escalation or known-defects document. | One-page runbook: what to check, who to tell, how to roll back, how to restore. |
| PROD-016 | Secrets | **PASS (evidence)** | `git ls-files` contains no `.env`, key or token. `.env.local` and `IMPORTANT.md` are gitignored. Brevo SMTP key rotated 2026-11-01 after it appeared in chat. | Keep the Supabase CLI PAT short-lived; it expires in ~7 days by design. |
| PROD-017 | Headers | **PASS (evidence)** | HSTS 2 years, CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy, COOP/COEP for the runner. | `'unsafe-inline'`/`'unsafe-eval'` are required by the runner and Next; document as accepted risk. |
| PROD-018 | AuthZ | **PASS (evidence)** | RLS on every table, owner-scoped policies, trigger-level extension lock, no service-role key in the client, runner kill switch (`RUNNER_ENABLED`). | Re-verify after any schema change. |
| PROD-019 | Legal pages | **PASS (evidence)** | `/terms`, `/privacy`, `/security`, `/dmca`, `/copyright` return 200; `/.well-known/security.txt` is now generated with an `Expires` value one year ahead, so it cannot lapse. | No manual reminder needed. |
| PROD-020 | Content | **PASS** | One `<h1>` per page, no localhost URLs in production HTML, no framework branding, no fake testimonials. | — |
| PROD-021 | SEO | **P2 (fixed)** | The root layout set `robots: { index: false }`, so **every** page, including `/home` and the policy pages, was `noindex` regardless of `robots.txt`. | Removed from the layout; `/app`, `/login`, `/settings` and `/versions` opt out individually. |
| PROD-022 | CSP | **Accepted** | CSP allows `'unsafe-inline'` and `'unsafe-eval'` (Next.js hydration, `new Function` in the sandboxed runner, Pyodide). | Documented here; re-review if the runner is removed. Not silently ignored. |

## Status counts

| Status | Count |
|---|---|
| PASS | 5 sections (legal, design/a11y, SEO, backend/data, deployment) |
| PARTIAL | 3 sections (security, QA, logging) |
| FAIL | 0 |
| NOT APPLICABLE | 3 (e-commerce, analytics by decision, AI) |
| BLOCKED | 0 |

## Remediation status — 2026-11-01

| Finding | State | Evidence |
|---|---|---|
| PROD-001 backup pipeline | **Fixed** | `/api/cron/backup` runs daily at 03:00 UTC (Vercel cron), gzips every table to the private `backups` bucket, re-downloads it, compares checksum and row counts, prunes after 30 days. First runs succeeded; the verify step caught a CDN-cache bug, now fixed with unique paths. |
| PROD-002 tested restore | **Fixed** | Restore drill executed 2026-11-01 against the real backup: every table reloaded into a scratch schema and counts matched exactly (1 profile, 10 folders, 22 files, 12 versions). Procedure in `docs/INCIDENT.md`. |
| PROD-003 error reporting | **Fixed (first-party)** | `error_events` table, `/api/errors` intake, `onRequestError` for server crashes, error boundaries for client crashes, newest 10 visible in Settings → Errors. Verified end-to-end live. Sentry remains optional if a DSN is added. |
| PROD-004 uptime alert | **Fixed** | `.github/workflows/uptime.yml` checks `/api/health` every 15 minutes; a failed run emails the repository owner. No third-party account. |
| PROD-005 trash purge | **Fixed** | `pg_cron` enabled; job `purge-trash` runs `0 3 * * *`, verified active in `cron.job`; manual run returned 0. |
| PROD-006 contrast | **Fixed** | `ink-faint` → `#7c827c` (4.83:1 panel), new `accent-text` → `#d2624a` (5.05:1 panel); all 25 `text-accent` usages moved to it. |
| PROD-008 sharing metadata | **Fixed** | `metadataBase`, Open Graph, Twitter card, canonical, `/og.png` (1200×630) and JSON-LD `WebApplication`. |
| PROD-009 robots | **Fixed** | `Allow: /` with private routes disallowed; no longer contradicts the sitemap. |
| PROD-011 lint | **Fixed** | `npm run lint` → 0 errors. |
| PROD-012 tests | **Fixed** | 18 tests in `src/lib/*.test.ts`, run by `npm test` (Node's built-in runner, no new dependency). |
| PROD-013 advisories | **Partial, build-time only** | 5 moderate remain, all in the Sentry SDK build plugin's `glob`/`minimatch` chain; no runtime exposure, no high/critical. An override was tested and reverted (glob 11 is still inside the advisory range and forcing a major is riskier than the advisory). |
| PROD-015 runbook | **Fixed** | `docs/INCIDENT.md`: checks, containment, restore, escalation, known defects, incident log. |
| PROD-010 Search Console | **Fixed** | Property verified with the HTML tag (live in the layout); `sitemap.xml` submitted 2026-11-01 with status **Success**. |
| Release smoke | **Fixed** | `npm run smoke` (`scripts/smoke.mjs`) and `.github/workflows/smoke.yml` (daily + manual). |
| CI gate | **Verified green (2026-11-01)** | `.github/workflows/ci.yml` runs typecheck, lint, tests and build on every push. All runs before `884d4b0` failed on `TS2304: LayoutProps` because typecheck ran before Next generated its types; the layout now types its props explicitly. Run on `884d4b0`: **success**. |

### Still open

All findings are closed or explicitly accepted. What remains is routine:

1. **PROD-013** — 5 moderate build-time advisories in the Sentry SDK chain; no
   high/critical, no runtime exposure. Re-check when Sentry ships a fixed major.
2. **PROD-014** — email sender limitation, accepted by the owner 2026-11-01.
3. **Daily backup** — verify a new object in `backups/daily/` after the 03:00 UTC
   run; the cron is registered and the first runs are verified.

Done since the first audit: Brevo key rotated, GitHub failure emails enabled,
Search Console verified, sitemap accepted, `security.txt` self-maintaining.

## Release decision

**READY.** All P0 and P1 findings are closed with evidence: backups run and
verify themselves, a restore drill passed, errors are recorded, availability is
checked every 15 minutes, and the site is verified in Search Console with its
sitemap accepted. Critical journeys pass the smoke suite live.

Nothing outstanding gates release. The email-sender limitation is accepted by
the owner, the remaining advisories are build-time only, accessibility is
recorded as passing (keyboard pass plus Lighthouse 100), `security.txt`
maintains its own expiry, and the Brevo key has been rotated.

## Checklist items deliberately not pursued

- **Dark/light toggle and system preference**: product decision, dark only
  (recorded in [PRODUCT.md](PRODUCT.md)). Not a defect.
- **Cookie banner**: only strictly necessary auth cookies are set, so no consent
  banner is required; adding analytics would change that.
- **E-commerce, refunds, PCI, shipping, inventory**: no commerce exists.
- **AI/LLM security**: no model calls anywhere in the product.
- **Status page**: conditional; a public status page has no audience while the
  product has one operator and no SLA.
