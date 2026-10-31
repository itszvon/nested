# Production readiness review

Date: 31 October 2026
Scope: the Nested repository at this commit, local development environment, Supabase project `purcbbalpuovesdndlik`.
Checklist: Website Production-Readiness Master Checklist v2.0 (24 pages).
Reviewer: the build agent. Not an independent auditor, not a penetration test, not a legal review.

## Overall decision

**CONDITIONALLY READY. Deployed and serving, with two P1 operational gaps that no code change closes.**

The application is deployed at https://nestedforyou.vercel.app and the smoke test below passed against it. Two P1 items remain: no backups, no alerting. Until those exist, anyone using the site is one bad migration or one dropped table away from losing their data with nobody notified, so READY is not available.

Updated 31 October 2026 after the first production deployment.

## Phase 1 — Audit

Verified directly:

- `npm run typecheck`, `npm run build`, `npm run db-check` (44 checks).
- HTTP responses and headers from the running dev server via curl.
- Repository inspection for committed secrets: none. `git ls-files` contains no `.env.local`, no Supabase keys, no Google client secret. `IMPORTANT.md` (which holds credentials) is gitignored.
- Dependency tree via `npm audit`.

Not verified, because the tooling is absent: browser rendering, screen reader behaviour, Lighthouse or Core Web Vitals, production DNS/TLS, restore.

## Phase 2 — Findings

| ID | Area | Observation | Priority | Status |
|---|---|---|---|---|
| SEC-001 | Headers | Only COOP and COEP were set. No CSP, no nosniff, no referrer policy, no frame protection, no Permissions-Policy | P1 | Fixed |
| SEC-002 | Routing | The proxy allow-listed public paths, so any unlisted path redirected to `/login`. `robots.txt`, `sitemap.xml` and every 404 were unreachable | P2 | Fixed |
| SEC-003 | Routing | Protection was expressed as an allow-list, which means a future public route defaults to protected but a typo defaults to open | P2 | Fixed: protected prefixes |
| SEC-004 | Accounts | No account deletion | P1 | Fixed: definer function deletes only the caller's auth row, no service key in the app |
| SEC-005 | Abuse | No rate limiting on server actions. Supabase applies its own limits to auth; storage quota and the 2 MB file cap bound write abuse | P2 | Accepted, documented |
| SEC-006 | Dependencies | 5 moderate advisories, all transitive through Sentry's glob/minimatch. The suggested fix is a breaking Sentry downgrade | P3 | Accepted |
| PRIV-001 | Legal | No privacy policy, despite collecting an email address and user content | P1 | Fixed |
| PRIV-002 | Legal | No terms of service | P1 | Fixed |
| PRIV-003 | Legal | Contact address is the operator's personal Gmail | P2 | Open, owner decision |
| PRIV-004 | Data | Drafts are stored in the browser only, which the privacy page states; no analytics exist, so no cookie banner is required | — | Not applicable |
| SEO-001 | Discovery | No robots.txt, no sitemap | P2 | Fixed |
| SEO-002 | Sharing | No Open Graph image; metadata titles and descriptions exist | P3 | Open |
| UX-001 | Failure states | No `not-found`, route `error`, or `global-error` page | P2 | Fixed |
| A11Y-001 | Dialogs | No focus trap and no focus restoration on close | P2 | Fixed |
| A11Y-002 | Motion | No reduced-motion handling | P3 | Fixed |
| A11Y-003 | Verification | No screen reader test, no automated axe run | P2 | Blocked: no tooling |
| OPS-001 | Backup | No backups and no restore procedure | P1 | Blocked: needs deploy and a storage target |
| OPS-002 | Monitoring | Health endpoint exists, nothing watches it, Sentry has no DSN | P1 | Blocked: needs credentials |
| OPS-003 | Docs | Runbook absent; environment variables undocumented | P2 | Fixed |
| TEST-001 | Testing | 44 database checks, zero end-to-end tests | P2 | Open |
| DB-001 | Integrity | RLS, ownership triggers, quotas and versioning are covered by tests | — | Pass |

Not applicable, with reasons: payments and transactions (no commerce), AI/LLM features (no model integration; the runner executes the user's own code in a sandbox), multi-tenant administration (single-user accounts), webhooks (none), email sending (none), subscriptions (none).

## Phase 3 — Plan

Ordered by risk:

1. Security headers and CSP.
2. Route protection model.
3. Legal pages and contact surface.
4. Error and not-found states.
5. Dialog focus management and reduced motion.
6. Documentation: environment variables, operations, this report.
7. Deferred: account deletion, backups, monitoring, rate limiting, E2E tests.

## Phase 4 — Implemented

**Security headers** (`next.config.ts`): Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy, plus HSTS in production only. `poweredByHeader` off. The CSP keeps `'unsafe-eval'` and `blob:` because the code runner evaluates user programs in a worker, and workers inherit the document policy. That is a real weakening, stated here rather than hidden.

**Route protection** (`src/lib/supabase/proxy.ts`): the allow-list became a protected-prefix list containing only `/app`. Unknown paths now return 404 instead of redirecting, and public files resolve.

**Legal pages**: `/privacy` and `/terms`, written from actual behaviour: what is stored, where, which processors, the single session cookie, the 30-day trash, the missing delete-account button. Both state that they were not written or reviewed by a lawyer.

**Error states**: `not-found.tsx`, `error.tsx` and `global-error.tsx`, each in the ledger style, the last one self-contained because it replaces the root layout.

**Accessibility**: dialogs trap Tab, focus the first control, close on Escape, and return focus to the invoking element. `prefers-reduced-motion` disables the remaining transitions.

**Documentation**: environment variable table and an operations table in `README.md` that names what is not built, rather than describing procedures that do not exist.

## Phase 5 — Verification

Run on 31 October 2026, local development, no independent review.

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run build` | Pass; `/privacy`, `/terms`, `/robots.txt` static, `/sitemap.xml` dynamic, `/app` protected |
| `npm run db-check` | 44 passed, 0 failed |
| `GET /home`, `/privacy`, `/terms` | 200 |
| `GET /robots.txt`, `/sitemap.xml` | 200 |
| `GET /nope` | 404 |
| `GET /app` without a session | 307 to `/login` |
| Response headers | CSP, nosniff, referrer policy, frame deny, permissions policy, COOP and COEP all present |
| Committed secrets | None found by pattern search |
| `npm audit` | 5 moderate, transitive, accepted |

## Phase 6 — Re-audit notes

The header work affects every response, including the API and auth callback. Verified by header inspection on `/home`; the same `source: "/(.*)"` rule applies to all routes.

The proxy change is the riskiest edit in this batch: it is the only thing separating a signed-out visitor from the app. Verified by requesting `/app` without a session and receiving a redirect. Row-level security independently prevents any cross-account read, so a proxy regression would expose an empty shell rather than user data.

The CSP has not been exercised in a browser. It is the item most likely to break something subtle: Pyodide, Prettier and sql.js load from jsDelivr, and the runner's worker uses `eval`. If the runner fails to start after this change, the console will report a CSP violation and the policy is the first place to look.

## Phase 7 — Outstanding and blocked

| Item | Status | Next action |
|---|---|---|
| Account deletion | Fixed | `/settings`, confirmed by a db-check that deletes a throwaway account and verifies folders and files vanish |
| Backups and restore | Blocked | Deploy, choose a storage target, schedule a dump, perform one restore into a scratch project |
| Monitoring and alerting | Blocked | Sentry DSN, external monitor on `/api/health`, alert routing to the operator |
| Rate limiting | Accepted | Revisit if the service is exposed publicly beyond a small group |
| E2E tests | Open | Playwright: sign in, create, save, restore, trash |
| Open Graph image | Open | Static image, 1200 by 630, accurate to the product |
| Screen reader pass | Blocked | Manual test with VoiceOver or NVDA |
| Support email | Open | Owner confirms or replaces the address used on the legal pages |
| Formatter coverage | Accepted | No formatter for Python, Go, Rust, SQL, Bash, C++ |

## Accepted risks

- **CSP allows `unsafe-eval` and `unsafe-inline` for scripts.** Required by the code runner and by Next's inline bootstrap. Removing the runner would allow tightening it.
- **Cross-origin isolation applies site-wide** (COOP/COEP), which blocks third-party resources without CORS. This is required for shared-memory stdin.
- **The Python and JavaScript runners execute user code in a worker** with network and storage stubs rather than a hardened sandbox. Documented in the runner source. This is a deliberate trade, accepted by the owner as part of the product.

## What this review is not

Not a penetration test, not a legal review, not an accessibility audit, not a restore test, not a production observation. Every PASS above rests on the evidence named next to it, in local development, on one machine, by the same agent that wrote the code.


## Deployment, 31 October 2026

Production: https://nestedforyou.vercel.app
Source: https://github.com/itszvon/nested, deployed from `master` by Vercel project `nested`.
Build: deployment dpl_F7uJmimcdBSu3b5b26AZk2KPTi14, state READY, region iad1.

Smoke test against production, run from this machine:

| Check | Result |
|---|---|
| `/home`, `/login`, `/privacy`, `/terms`, `/security`, `/dmca`, `/copyright` | 200 |
| `/robots.txt`, `/sitemap.xml` | 200, sitemap uses the production origin |
| `/app` without a session | 307 to `/login` |
| `/nope` | 404 |
| Security headers | CSP, HSTS, nosniff, referrer, frame, permissions, COOP, COEP all present |
| `/api/health` | `{"ok":true,"database":200}` |
| OAuth handoff | Supabase returns a 302 to Google with the production callback accepted |

Changed during deployment: project deployment protection disabled (it defaults to requiring a Vercel login on `*.vercel.app`), environment variables set for all three targets, Supabase `site_url` moved to the production domain with localhost and the preview alias kept in the allow list.

Still unverified on production: signing in with a real Google account, the editor and runner in a browser, and the daily cron. The OAuth handoff is proven; the callback is not.
