# Production-readiness audit

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
| 2 | Design, UX, responsive, accessibility | **PARTIAL** | Dark-only is a recorded product decision (NA for the toggle); no cookie banner needed (auth cookies only, no analytics); FAQ, back-to-top, copy-to-clipboard present. Two contrast failures and no device/screen-reader verification. |
| 3 | SEO, discovery, sharing | **FAIL** | No Open Graph, Twitter card, canonical or structured data. `robots.txt` blocks everything except `/home` for general crawlers while `sitemap.xml` advertises the legal pages. Search Console setup BLOCKED (no account access). |
| 4 | Security and infrastructure | **PARTIAL** | Strong headers, RLS verified, least-privilege keys, kill switch for the runner. No status page; 5 moderate dependency advisories. |
| 5 | E-commerce and payments | **NOT APPLICABLE** | No products, cart, checkout or payments. |
| 6 | Backend, database, data integrity | **FAIL** | No database backups and no tested restore. `purge_trash()` exists but nothing ever calls it, so trashed rows are never physically removed and storage is never reclaimed. |
| 7 | Quality assurance and testing | **PARTIAL** | Typecheck and build pass; email confirmation verified end-to-end. No automated tests, no mobile-browser or offline testing, no documented known-defects list. |
| 8 | Deployment and release management | **PARTIAL** | Deploys from `master`, production env separated from local, health endpoint live. No automated smoke test, no deployment-failure alerting, migrations are forward-only with no rollback procedure. |
| 9 | Analytics, metrics, reporting | **FAIL** | No analytics at all, so no engagement or storage trend data exists. (Privacy-positive, but it means every product decision is guesswork.) |
| 10 | AI / LLM / agent security | **NOT APPLICABLE** | No LLM features. The runner executes user code in a sandboxed worker with network disabled, which is a different threat model and is covered in §4. |
| 11 | Logging, monitoring, incident response | **FAIL** | Sentry code exists but no DSN is configured, so nothing is reported. No uptime alert, no SLOs, no incident-response or escalation document. |

## Findings

| ID | Area | Priority | Observation | Recommendation |
|---|---|---|---|---|
| PROD-001 | Backups | **P1** | Supabase free tier has no vendor backups; none are taken elsewhere. | Nightly `pg_dump` to private storage, 30-day retention, credentials outside the repo. |
| PROD-002 | Recovery | **P1** | No restore has ever been performed, so backup viability is unproven. | Restore into a scratch project, time it, write the runbook. |
| PROD-003 | Monitoring | **P1** | Sentry DSNs absent (not in `.env.local`, not in Vercel env); failures are invisible. | Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`, send a test error, confirm delivery. |
| PROD-004 | Monitoring | **P1** | `/api/health` is polled by a Vercel cron but nobody is alerted when it fails. | Free uptime monitor with email/SMS escalation. |
| PROD-005 | Data lifecycle | **P2** | `purge_trash` is revoked from `authenticated` and never scheduled, so trashed rows and their bytes stay forever. | Daily cron (service role) calling `purge_trash(30)`; report reclaimed bytes. |
| PROD-006 | Accessibility | **P2** | `--color-ink-faint` (#6a706b) is 3.87:1 on ground and 3.74:1 on panel — below 4.5:1 for the 9–10px labels it is used for. `--color-accent` (#a8442f) as text is 3.3:1. | Lighten ink-faint and use a lighter accent for text, or reserve both for large text and borders only. |
| PROD-007 | Accessibility | **P2** | No screen-reader or real-device pass; keyboard flows are implemented but unverified end to end. | Manual NVDA/VoiceOver + iPhone/Android pass; record results. |
| PROD-008 | SEO | **P2** | No OG/Twitter tags, canonical links or JSON-LD; a shared link renders as a bare title. | Add `metadataBase`, `openGraph`, `twitter`, and a canonical per page; one static OG image. |
| PROD-009 | SEO | **P2** | `robots.txt` ends with `Disallow: /`, so general crawlers may fetch only `/home`, while the sitemap lists `/security`, `/dmca`, `/copyright`. | Decide the policy: allow the public pages, keep `/app`, `/login`, `/auth`, `/api` disallowed. |
| PROD-010 | Search Console | **BLOCKED** | No Search Console property or sitemap submission. | Owner action; then verify indexing. |
| PROD-011 | Code quality | **P2** | `npm run lint` fails: 21 errors (setState-in-effect in dialogs, unescaped entities on legal pages). | Fix them so lint is a real gate in CI. |
| PROD-012 | Testing | **P2** | No automated tests at all. | Start with pure modules: tree assembly, whitespace, copy naming, diff rows, export paths. |
| PROD-013 | Supply chain | **P2** | `npm audit --omit=dev`: 5 moderate advisories. | Review and upgrade where non-breaking; track the rest. |
| PROD-014 | Email | **P2** | Sender is a Brevo-rewritten Gmail address (`pothole3000@….brevosend.com`); no SPF/DKIM on a product domain. | Verify a domain and send from `noreply@` it. |
| PROD-015 | Ops docs | **P2** | No incident-response, escalation or known-defects document. | One-page runbook: what to check, who to tell, how to roll back, how to restore. |
| PROD-016 | Secrets | **PASS (evidence)** | `git ls-files` contains no `.env`, key or token. `.env.local` and `IMPORTANT.md` are gitignored. | Keep as is; rotate the Brevo SMTP key that appeared in chat. |
| PROD-017 | Headers | **PASS (evidence)** | HSTS 2 years, CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy, COOP/COEP for the runner. | `'unsafe-inline'`/`'unsafe-eval'` are required by the runner and Next; document as accepted risk. |
| PROD-018 | AuthZ | **PASS (evidence)** | RLS on every table, owner-scoped policies, trigger-level extension lock, no service-role key in the client, runner kill switch (`RUNNER_ENABLED`). | Re-verify after any schema change. |
| PROD-019 | Legal pages | **PASS (evidence)** | `/terms`, `/privacy`, `/security`, `/dmca`, `/copyright` return 200; `/.well-known/security.txt` returns a contact, policy link and expiry. | Keep the expiry date in security.txt current. |
| PROD-020 | Content | **PASS** | One `<h1>` per page, no localhost URLs in production HTML, no framework branding, no fake testimonials. | — |

## Status counts

| Status | Count |
|---|---|
| PASS | 5 sections/items |
| PARTIAL | 4 |
| FAIL | 4 |
| NOT APPLICABLE | 2 |
| BLOCKED | 1 |

## Release decision

**NOT READY** until PROD-001 through PROD-004 are closed. They are the only
items that turn a working product into a trustworthy one.

After that, the site is **CONDITIONALLY READY**: PROD-005 (trash purge),
PROD-006 (contrast), PROD-008/009 (SEO metadata and robots) and PROD-011 (lint)
should follow within the first week, and PROD-010 needs the owner.

## Checklist items deliberately not pursued

- **Dark/light toggle and system preference**: product decision, dark only
  (recorded in [PRODUCT.md](PRODUCT.md)). Not a defect.
- **Cookie banner**: only strictly necessary auth cookies are set, so no consent
  banner is required; adding analytics would change that.
- **E-commerce, refunds, PCI, shipping, inventory**: no commerce exists.
- **AI/LLM security**: no model calls anywhere in the product.
- **Status page**: conditional; a public status page has no audience while the
  product has one operator and no SLA.
