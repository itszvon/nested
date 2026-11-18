# Production-readiness audit — 2026-11-11

Audit of `https://nestedforyou.vercel.app` against the *Complete Website
Production-Readiness Master Checklist v2.1* (October 2026), run after the landing
page redesign shipped.

- **Deployed commits:** `5dbd98b` (landing redesign) and `e0fd2d8` (contrast and
  skip-link fixes)
- **Production:** https://nestedforyou.vercel.app
- **Audit date:** 2026-11-11 (UTC)
- **Auditor:** the build agent. Not an independent auditor, not a penetration
  test, not a legal review.
- **Previous audit:** [PRODUCTION-AUDIT.md](PRODUCTION-AUDIT.md) (2026-11-01)

## Scope and verification limits

Checked live: routes, redirects, headers, TLS, cookies, analytics references,
robots, sitemap, `security.txt`, health, Open Graph/canonical/structured data,
internal links, keyboard behaviour, responsive layout, interactive landing
components, Lighthouse, smoke suite. Checked repository: CI workflows, security
headers, env template, gitignore, rate limits, admin guards, clipboard/print/FAQ,
secrets. Checked database: RLS, cron jobs, unique indexes, backup bucket objects,
error events, `SECURITY DEFINER` function definitions and grants.

**Not verified, and therefore not claimed as PASS:** screen-reader sessions, real
mobile devices, Safari/Firefox, load testing, penetration testing, fault
injection, and GitHub Actions run status for the latest commits (the Actions API
is not readable with the available credentials). These are marked BLOCKED or
noted as verification gaps below.

## Live evidence

| Check | Result |
|---|---|
| `/home`, `/login`, `/privacy`, `/terms`, `/security`, `/copyright`, `/dmca` | 200 |
| `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt`, `/api/health` | 200 |
| `/app`, `/settings`, `/settings/admin`, `/settings/versions`, `/settings/suggestions` signed out | 307 to sign-in |
| `/nope` | 404 |
| `/api/health` body | `{"ok":true,"database":200}` |
| HTTP → HTTPS | 308 to `https://` |
| TLS verification | `ssl_verify_result=0` |
| TTFB, three samples | 71 ms, 84 ms, 78 ms |
| `Set-Cookie` on `/home` | none |
| Analytics/tracking references | none |
| Security headers | CSP, HSTS, nosniff, referrer policy, `X-Frame-Options: DENY`, Permissions-Policy, COOP, COEP, `frame-ancestors 'none'` all present |
| Smoke suite | 13/13 passed, including OG/canonical and gated download 401 |
| Internal public links | `/home`, `/privacy`, `/terms`, `/security`, `/copyright`, `/dmca`, `/icon.svg` all 200 |
| H1 count | exactly one on every public page |
| Canonical | `/home` present; indexable policy pages lack one (P3) |
| OG / Twitter tags | present on all public pages |
| Structured data | `WebApplication` JSON-LD on `/home` |
| Localhost / framework branding | none in rendered HTML |
| Em dashes in rendered copy | none |
| Images without alt | none (no content images) |
| Responsive | 390 × 844 portrait and 844 × 390 landscape, no horizontal overflow |
| Keyboard | first Tab focuses “Skip to content”; FAQ, folder demo, range scrubber all operable; range goes rev 5 → 4 with ArrowLeft |
| Console errors on `/home` | none |
| Live interactions | depth 3 → 4, FAQ opens, range changes, no hydration errors |

### Lighthouse (production, mobile, headless Chrome)

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `/home` | 98 | **100** | 100 | 100 |
| `/security` | — | **100** | 100 | 100 |
| `/login` | — | **100** | 100 | 63 (intentional `noindex`) |

`/home` metrics: FCP 1.1 s, LCP 1.1 s, CLS 0, TBT 140 ms.

The first run before the fix scored accessibility 96. Axe identified footer
metadata at 3.88:1; that was corrected in `e0fd2d8`, and the re-run is 100.

## Repository and database evidence

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 8 warnings |
| `npm test` | 33 passed, 0 failed |
| `npm run build` | pass; `/home` static |
| `npm run smoke` (production) | 13/13 passed |
| `npm audit --omit=dev` | 5 moderate, build-time Sentry `glob`/`minimatch` chain |
| Tracked secret files | none (`git ls-files`); `.env*` and `IMPORTANT.md` ignored |
| CI workflow | `.github/workflows/ci.yml` runs typecheck, lint, test and build on `master` |
| Smoke workflow | daily at 12:00 UTC |
| Uptime workflow | `/api/health` every 15 minutes; failed run emails the owner |
| Public tables with RLS | 10 of 10 |
| Trash purge cron | `purge-trash`, daily 03:00 UTC, active |
| Backups bucket | private, 11 objects, newest `2026-11-11T03:34Z` |
| Restore drill | documented and previously executed row-for-row (`INCIDENT.md`) |
| Unique indexes | files/folders name uniqueness, profiles username, plus primary keys |
| Admin RPCs | `admin_overview` and `admin_users` both raise unless `is_admin()` |
| Account deletion | `delete_my_account()` deletes only `auth.uid()` |
| Runner kill switch | `NEXT_PUBLIC_RUNNER_ENABLED=false` hides button and returns 403 |
| Rate limits | `/api/run` 8/min per account, `/api/errors` 20/min per IP, in memory |

## Section results

| # | Section | Status | Evidence |
|---|---|---|---|
| 1 | Legal, copyright, content | **PASS** | Five policy pages live; operator and support contact published; no unsupported claims or testimonials; suggestions are not publicly rendered; JSON-LD is the only `dangerouslySetInnerHTML` |
| 2 | Design, UX, responsiveness, accessibility | **PASS** | Dark-only is a recorded product decision; Lighthouse 100 on `/home`, `/security`, `/login`; skip link, focus states, keyboard operation, reduced motion, print CSS, FAQ, back-to-top, copy-to-clipboard; no emoji, purple gradients, em dashes or cursor effects |
| 3 | SEO, discovery, sharing | **PASS** | Canonical, OG/Twitter, JSON-LD, `robots.txt` with AI crawlers allowed and private routes disallowed, sitemap, custom 404, favicon, CTA above the fold; Search Console verified and sitemap accepted 2026-11-01 |
| 4 | Security and infrastructure | **PASS** | CSP/HSTS/frame/referrer/permissions/COOP/COEP; TLS valid; auth and admin routes gated; RLS on all tables; secrets untracked; kill switch; only advisory grants and build-time advisories remain |
| 5 | E-commerce and payments | **NOT APPLICABLE** | No products, cart, checkout, payments, subscriptions or shipping |
| 6 | Backend, database, data integrity | **PASS** | Daily self-verifying backups (newest today), documented restore drill, active trash purge, unique indexes, all public tables under RLS, private backup bucket |
| 7 | Quality assurance and testing | **PARTIAL** | 33 unit tests, 13 smoke checks, build/lint/typecheck, keyboard and responsive passes, Lighthouse; screen-reader, real-device, Safari/Firefox, offline and fault-injection tests remain BLOCKED |
| 8 | Deployment and release management | **PASS** | Deployed from `master`, production env separate, smoke passed after deploy, CI gate configured, rollback and incident procedures documented; latest Actions status not readable (see QA-002) |
| 9 | Analytics, metrics, reporting | **NOT APPLICABLE (decision)** | No analytics by design; no tracking cookies; no financial metrics |
| 10 | AI, LLM and agent security | **NOT APPLICABLE** | No model calls or AI features; the runner executes the user's own code in a sandboxed worker |
| 11 | Logging, monitoring, incident response | **PARTIAL** | First-party `error_events`, 15-minute uptime alert, incident runbook, known-defects list; no SLOs, trace IDs or public status page |

## Findings

### Closed during this audit

| ID | Area | Priority | Finding | Resolution |
|---|---|---|---|---|
| A11Y-001 | `/home` footer | P2 | Footer metadata computed to 3.88:1 (`text-ghost/80` at 8.5px), dropping Lighthouse accessibility to 96. | Removed the opacity, raised to 9px; re-run 100. |
| A11Y-002 | `/home` navigation | P2 | Long landing page had no mechanism to bypass the repeated header (WCAG 2.4.1). | Added a visible-on-focus “Skip to content” link; first Tab now reaches it. |
| A11Y-003 | Code previews | P3 | Comment and line-number micro-text was below 4.5:1. | Lightened the comment token and line numbers. |

### Open or accepted

| ID | Area | Priority | Status | Finding / recommendation |
|---|---|---|---|---|
| SEC-001 | Database grants | P3 | Open | Three trigger functions (`files_account`, `versions_account`, `handle_new_user`) are executable by `anon`/`authenticated` through RPC. Direct calls raise “trigger functions can only be called as triggers”, so this is not exploitable, but `EXECUTE` should be revoked as hardening. |
| SEC-002 | Rate limiting | P2 | Accepted | `/api/run` and `/api/errors` use in-memory counters that reset per serverless instance; server actions have no app-layer limiter. Supabase auth limits and storage quotas bound the damage. Revisit if exposure grows. |
| SUP-001 | Supply chain | P3 | Accepted | 5 moderate advisories, all build-time `glob`/`minimatch` under Sentry; no high/critical and no runtime exposure. Re-check when Sentry ships a fixed major. |
| SEO-001 | Canonicals | P3 | Open | `/security`, `/copyright` and `/dmca` are indexable but have no canonical; `/privacy` and `/terms` are deliberately `noindex` and absent from the sitemap. |
| UX-001 | Landing extras | P3 | NOT APPLICABLE | No scroll-progress indicator or floating contact button. Copy-to-clipboard exists in the app, print CSS is global, contact is on the legal pages. Not required by this product. |
| OPS-001 | Operations | P3 | Open | No formal SLOs, trace IDs or public status page. Uptime monitoring, first-party error events and a runbook exist. A status page has no audience at one operator and no SLA. |
| QA-001 | Verification | P2 | Blocked | No screen-reader session and no real-device/Safari/Firefox pass. Chrome mobile, keyboard and responsive checks passed; do not claim screen-reader certification. |
| QA-002 | CI evidence | P3 | Blocked | GitHub Actions runs for `5dbd98b`/`e0fd2d8` could not be read with the available credentials. The same gates passed locally; CI workflow is present and previously green. |
| PRIV-001 | Contact | P3 | Accepted | Support contact is a personal Gmail address. Published intentionally; the operator accepted the limitation. |
| EMAIL-001 | Email | P2 | Accepted | Confirmation mail uses a Brevo-rewritten Gmail sender without product-domain SPF/DKIM. Owner accepted; revisit if a domain is purchased. |

### Duplicate or conflicting checklist instructions

- **Dark/light toggle vs dark-only product.** The checklist asks for a toggle
  “where specified”; `PRODUCT.md` records dark-only as a product decision. Marked
  N/A, not a defect.
- **Cookie banner vs no tracking.** The banner is conditional; the site sets no
  cookie on public pages and has no analytics, so no banner is required.
- **Copy/floating contact/scroll progress.** Listed as universal extras, but the
  copy action exists in the app and contact is on the policy pages; these are not
  added to the marketing page merely to satisfy the list.
- **Status page “where appropriate”.** Not appropriate for a free,
  single-operator service with no SLA; monitoring and the runbook cover the need.
- **“Do not add features” vs checklist extras.** Features were not added; only
  the skip link and contrast fixes were made.

## Status counts

Checklist sections (11):

| Status | Count |
|---|---|
| PASS | 6 (sections 1, 2, 3, 4, 6, 8) |
| PARTIAL | 2 (sections 7, 11) |
| NOT APPLICABLE | 3 (sections 5, 9, 10) |
| FAIL | 0 |
| BLOCKED | 0 at section level; specific verification items are blocked inside §7 |

Findings:

| Priority | Open/accepted | Closed this run |
|---|---|---|
| P0 | 0 | 0 |
| P1 | 0 | 0 |
| P2 | 3 (SEC-002, QA-001, EMAIL-001) | 2 |
| P3 | 6 (SEC-001, SUP-001, SEO-001, OPS-001, QA-002, PRIV-001) | 1 |

No open P0 or P1 finding. Critical journeys — landing, sign-in handoff, gated
app and settings routes, health, download authorization, backups — are working.

## Seven-phase record

1. **Audit:** live route/header/HTML/link/cookie/Lighthouse checks, repository
   inspection, Supabase RLS/cron/index/backup inspection.
2. **Findings:** table above, with two new P2 accessibility regressions and one
   P3 code-contrast issue found and fixed.
3. **Plan:** fix only the regressions introduced by the redesign; leave accepted
   risks and product decisions unchanged.
4. **Implement:** commit `e0fd2d8` — footer and micro-label contrast, skip link,
   comment/line-number contrast.
5. **Test:** typecheck, lint, 33 tests, production build, 13 smoke checks,
   Lighthouse, live keyboard and responsive checks.
6. **Re-audit:** `/home` accessibility 96 → 100; all public links 200; no console
   errors; no overflow at 390 or 844.
7. **Decision:** below.

## Final production acceptance gate

**READY.**

No P0 or P1 findings are open. The site is deployed at `e0fd2d8`, the production
smoke suite passes, public pages are fast and accessible, backups are current
and self-verifying, and auth, admin and data access are gated.

Remaining items are P2/P3 and are recorded, not hidden: in-memory rate limiting,
the accepted email sender, build-time advisories, missing canonicals on three
policy pages, no SLOs/status page, and the blocked manual screen-reader and
real-device passes. The two regressions introduced by the redesign were fixed
and re-verified.
