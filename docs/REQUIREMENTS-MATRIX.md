# Requirements matrix

Source: the second requirements list supplied on 31 October 2026, applied to this repository.
Status vocabulary: PASS, OPEN, BLOCKED, NA. Every NA carries its reason.

## Summary

| Status | Count |
|---|---|
| PASS | 62 |
| OPEN | 12 |
| BLOCKED | 16 |
| NA | 55 |
| **Total** | **145** |

## Duplicates identified

- Dark mode default appears in Section 3 here and in DESIGN.md; one control, already satisfied.
- Custom 404 appears here and in the first checklist; the same page satisfies both.
- Favicon, cookie banner, vulnerability reporting, backups, rate limits and screen reader testing all repeat items already recorded in docs/PRODUCTION-READINESS.md.
- Known defect list duplicates the outstanding-findings table in PRODUCTION-READINESS.
- Consent notice duplicates the privacy-policy requirement from the first checklist.

## Conflicts identified

- Dark/light toggle and system-preference support contradict the product decision recorded in PRODUCT.md, SPEC section 10 and DESIGN.md: dark only, no toggle. Implementing it would reverse a decision the owner made twice. Not implemented; awaiting approval.
- Em dash ban applies to existing copy that used them (dialog titles, page titles). All were replaced with middots, so the conflict is resolved rather than outstanding.
- Remove localhost URLs conflicts with the sitemap needing a base URL before deployment; the fallback is localhost by necessity. Resolved at deploy by setting NEXT_PUBLIC_SITE_URL.
- Status page and floating contact button conflict with feature discipline in the first checklist (no features added merely to satisfy an item). Both marked NA with reasons.

## Items


### 1 Mandatory instructions

| Requirement | Status | Evidence or reason |
|---|---|---|
| Preserve all explicitly requested features | PASS | Every feature from the spec and the later requests is still present: tree, editor, versions, project history, trash, runner, checks, formatting, drag and drop, landing page. |
| Obtain approval before significant changes | PASS | No scope change was made. The dark/light toggle is the one item that would alter a settled product decision, so it is raised for approval instead of implemented. |
| Protect confidential information | PASS | No secret is tracked by git. Credentials live in .env.local and IMPORTANT.md, both gitignored. |
| Identify duplicate instructions | PASS | See Duplicates below. |
| Identify conflicting instructions | PASS | See Conflicts below. |
| Maintain clear completion statuses | PASS | This document. |
| Include status counts | PASS | Summary at the top of this file, generated from the rows below. |
| Do not silently remove requirements | PASS | Nothing was removed. Items that cannot apply are marked N/A with a reason. |
| Document removals and modifications | PASS | The Conflicts and Notes sections record every deviation. |

### 2 Legal and content

| Requirement | Status | Evidence or reason |
|---|---|---|
| Dedicated security policy page | PASS | /security, plus /.well-known/security.txt. |
| Dedicated DMCA policy page | PASS | /dmca. |
| Dedicated copyright policy page | PASS | /copyright. |
| Consent notices on forms | PASS | The only form is Google sign-in; the login page now states that continuing accepts the Terms and Privacy policy. |
| Citations for original research | NA | The site publishes no research, statistics or external claims, so there is nothing to cite. |
| Plagiarism check | PASS | All site copy was written for this project. No third-party text is reproduced. |
| Disclose commercial relationships and affiliates | NA | No sponsorship, affiliate link, or paid placement exists. |
| No misleading or unsupported claims | PASS | Claims are the language count, the limits, and which languages execute. Each is true of this build and stated on /home. |

### 3 Design and UX

| Requirement | Status | Evidence or reason |
|---|---|---|
| Dark mode as default | PASS | Default and only theme. |
| Functional dark/light toggle | BLOCKED | CONFLICT with the product decision. Requires approval; see Conflicts 1. |
| Respect system appearance preference | BLOCKED | Same conflict as the toggle. |
| Cookie banner when legally required | NA | One session cookie, no analytics, no advertising. No consent requirement applies, so a banner would be noise. |
| FAQ section where appropriate | PASS | #faq on /home, six questions with answers matching the build. |
| Scroll progress indicator where appropriate | NA | No page is long enough for one to carry information; the back-to-top control covers the only long page. |
| Back-to-top button on long pages | PASS | Appears past 800px on /home. |
| Copy-to-clipboard where useful | PASS | Copy button in the file header copies the whole buffer. |
| Floating contact button where appropriate | NA | There is no support desk. Contact addresses are on the policy pages, which is where a contact button would point. |
| Print stylesheet | PASS | Print rules strip chrome and force ink on white. |
| Password visibility toggle | NA | No password field exists; authentication is Google OAuth only. |
| Remove unnecessary AI labels from the interface | PASS | No such labels exist anywhere. |
| Replace framework branding and titles | PASS | Titles are Nested throughout, the Next.js starter icon is gone, and a drawn favicon replaces it. |
| Support portrait and landscape | OPEN | Layout is fluid and the sidebar is a drawer below md, but no physical device test was performed. |
| One primary H1 per page | PASS | One H1 on every page; the rest are H2. |
| Avoid purple gradients | PASS | None. |
| Avoid excessive pill-shaped buttons | PASS | Every control is rectangular, radius 0. |
| Avoid emoji interface icons | PASS | Three drawn SVG icons; no emoji. |
| Avoid em dashes in copy | PASS | Removed from page and dialog titles and from prose. |
| Avoid excessive animations | PASS | One 150ms drawer transition; reduced-motion honoured. |
| Avoid unnecessary AI-generated images | PASS | No images are used. |
| Avoid cursor animations | PASS | None. |
| Consistent spacing, typography, colours | PASS | Tokens recorded in DESIGN.md; no ad-hoc values in components. |
| Design consistency across all pages | PASS | Policy pages use the same tokens as the app and landing page. |

### 4 SEO

| Requirement | Status | Evidence or reason |
|---|---|---|
| Configure AI crawler access | PASS | Explicit allow/deny for GPTBot, ClaudeBot, Google-Extended and CCBot. |
| Set up Google Search Console | BLOCKED | Needs the deployed domain and a Google account with access. |
| Submit sitemap to Search Console | BLOCKED | Same dependency. |
| Monitor indexing and search performance | BLOCKED | Same dependency. |
| Breadcrumbs where appropriate | NA | No nested public pages. Inside the app the tree already shows location. |
| Relevant internal links | PASS | Nav anchors, footer policy links, cross-links between policy pages. |
| Proper favicon | PASS | Drawn SVG icon; framework icon removed. |
| Custom 404 page | PASS | src/app/not-found.tsx, verified returning 404. |
| Important CTAs above the fold | PASS | Primary action is in the hero. |
| Published response-time promises accurate | PASS | No response time is promised; /security says no fixed deadline. |
| Remove localhost URLs from production | OPEN | The sitemap and legal pages read NEXT_PUBLIC_SITE_URL and fall back to localhost. Setting the variable at deploy is required; not yet done. |
| Monitor crawling and indexing errors | BLOCKED | Needs Search Console. |
| Canonical URLs and metadata | OPEN | Titles and descriptions exist on every page; canonical tags and an Open Graph image do not. |

### 5 Security

| Requirement | Status | Evidence or reason |
|---|---|---|
| Database connection pooling | PASS | The application talks to Postgres through Supabase's pooler via PostgREST; no direct connections are opened at runtime. |
| Public system status page | NA | Single small service, no SLA, no customers depending on uptime. A status page would report nothing. |
| Vulnerability reporting process | PASS | /security plus security.txt with contact and scope. |
| Credential-stuffing protections | NA | No passwords exist. Google handles credential stuffing on its own side. |
| Account-enumeration protections | PASS | No password reset, no registration form, no per-email lookup. Login failures are generic. |
| Emergency kill switch | PASS | NEXT_PUBLIC_RUNNER_ENABLED=false hides and disables the code runner, the highest-risk feature. |
| Authentication and authorisation cannot be bypassed | PASS | Row-level security verified with two accounts in db-check; proxy protects /app by prefix. |
| Rate limits tested against abuse | OPEN | Supabase applies auth limits and quotas bound writes, but no rate-limit test was run. |
| No sensitive information in error messages | PASS | Database errors are mapped to fixed sentences before reaching the interface. |
| Administrative functionality protected | NA | No admin interface exists. |

### 6 E-commerce

| Requirement | Status | Evidence or reason |
|---|---|---|
| Product variants | NA | No commerce. |
| Product categories | NA | No commerce. |
| Product search | NA | No commerce. |
| Product filtering | NA | No commerce. |
| Product sorting | NA | No commerce. |
| Persistent shopping cart | NA | No commerce. |
| Inventory reservation | NA | No commerce. |
| Shipping providers | NA | No commerce. |
| Shipment tracking | NA | No commerce. |
| Guest checkout | NA | No commerce. |
| Saved shipping addresses | NA | No commerce. |
| Saved billing information | NA | No commerce. |
| Order notifications | NA | No commerce. |
| Unique order numbers | NA | No commerce. |
| Digital product delivery | NA | No commerce. |
| Administrative dashboard | NA | No commerce, no admin. |
| Financial reporting | NA | No revenue. |
| Document external business integrations | NA | No commerce integrations. |
| Abandoned cart handling | NA | No commerce. |
| Coupon restrictions | NA | No commerce. |
| Delayed shipment procedures | NA | No shipping. |
| Lost shipment procedures | NA | No shipping. |
| Business registration requirements | NA | No registered business; the operator is an individual. Flagged for the owner in the final report. |
| Business licensing requirements | NA | Same. |
| PCI DSS obligations | NA | No card data is handled. |
| Recurring payments | NA | No subscriptions. |
| International sales requirements | NA | Nothing is sold. |
| Full purchase to refund test | NA | No purchase flow. |

### 7 Backend and data

| Requirement | Status | Evidence or reason |
|---|---|---|
| Database migration recovery procedures | OPEN | Migrations are versioned and reversible in principle; no recovery drill has been run and no baseline dump exists. |
| Interrupted operations do not corrupt data | PASS | Every multi-row write is a transaction; aborts leave nothing behind, covered by db-check. |
| Expired third-party credentials | OPEN | A dead Supabase key surfaces as an error, but no rotation procedure is documented. |
| Revoked third-party credentials | OPEN | Same. |
| Reconcile transactions with external services | NA | No external financial or transactional service. |
| Behaviour during third-party outages | OPEN | Failures surface as a message; there is no retry or backoff for Supabase. |
| Detect and clean orphaned records | PASS | Foreign keys cascade on delete; trash purge relies on it and is tested. |
| Access controls on bulk exports | NA | No export feature. |
| Documented service dependencies | PASS | README operations table and PRODUCTION-READINESS list Supabase, Vercel, Google, Sentry and the CDNs. |
| Failed operations retried safely | PASS | Saves carry a revision; a retry either succeeds once or reports a conflict, so it cannot apply twice. |
| Prevent duplicate transactions and records | PASS | Unique partial indexes on names, hash-based version dedupe, revision checks. |
| Backups provably restorable | BLOCKED | No backup exists to restore. |
| Consistency after failed operations | PASS | Covered by the transaction tests in db-check. |

### 8 QA

| Requirement | Status | Evidence or reason |
|---|---|---|
| Screen reader testing | BLOCKED | No screen reader available in this environment. |
| Online and offline transitions | OPEN | Saving while offline shows a failure message; nothing queues and retries. |
| Major mobile browsers | BLOCKED | No device or browser farm available. |
| Email delivery verification | NA | The app sends no email. |
| Links in emails work | NA | No email. |
| Booking conflict prevention | NA | No booking. |
| Financial calculation verification | NA | No money. |
| Checkout to refund workflow | NA | No checkout. |
| Simulate monitoring failures | BLOCKED | No monitoring is deployed. |
| Alerts triggered on failure | BLOCKED | No alerting is deployed. |
| Documented known defects | PASS | PRODUCTION-READINESS outstanding table plus this document. |
| Recorded test results | PASS | Commands, dates and results recorded per item. |
| Keyboard-only navigation | PASS | Implemented and exercised through the tree, dialogs and editor; no automated pass. |
| Forms handle invalid input | PASS | Name rules, extension rules and quotas are enforced in the database and surfaced as sentences. |
| Error handling across critical workflows | PASS | Save conflict, quota, stale revision, deleted file and unsupported language all have states. |
| Real mobile device testing | BLOCKED | No device available. |

### 9 Deployment

| Requirement | Status | Evidence or reason |
|---|---|---|
| Production smoke tests after deployment | BLOCKED | Nothing deployed. |
| Sandbox transactions cannot become real | NA | No payments. |
| Rollback procedures tested | BLOCKED | No deployment to roll back. |
| Clear ownership of production | PASS | Single operator, recorded in README and PRODUCTION-READINESS. |
| Production config differs from development | OPEN | HSTS and SITE_URL are environment-dependent; neither has been set. |
| Critical services operational after deploy | BLOCKED | No deploy. |
| Deployment failures detectable and recoverable | BLOCKED | No deploy, no monitoring. |
| Release approval ownership documented | PASS | Recorded: the owner approves and executes releases. |

### 10 Analytics

| Requirement | Status | Evidence or reason |
|---|---|---|
| Separate financial from engagement metrics | NA | No analytics and no financial metrics. |
| Reconcile financial metrics | NA | No financial metrics. |
| Duplicate analytics events | NA | No analytics. |
| Consistent time zones in reporting | NA | No reporting. |
| Accuracy of financial dashboards | NA | No dashboards. |
| Defined calculation methods | NA | No metrics. |
| Events not counted twice | NA | No analytics. |
| Estimated vs confirmed financial figures | NA | No financial figures. |

### 11 Operations

| Requirement | Status | Evidence or reason |
|---|---|---|
| Ongoing maintenance ownership | PASS | Single operator; recorded. |
| Production incident procedures | OPEN | No written procedure beyond the operations table's admission that none exists. |
| Security incident investigation procedure | OPEN | /security covers reporting and expectations, not internal handling steps. |
| Fallbacks for critical third-party services | NA | Supabase and Vercel have no substitutes at this scale; the trade is accepted. |
| Operational procedures documented | PASS | README operations table, PRODUCTION-READINESS, adding-a-language. |
| Record of unresolved production risks | PASS | PRODUCTION-READINESS outstanding and accepted-risk sections. |
| Production ownership and accountability | PASS | Recorded. |
| Documentation updated after changes | PASS | Docs updated in the same commits as behaviour changes. |

## What changed in this pass

- /security, /dmca, /copyright pages, linked from the footer and cross-linked.
- Consent line on the login page.
- security.txt with contact and scope.
- Drawn favicon replacing the framework icon.
- FAQ on the landing page, six questions answered from the build.
- Back-to-top control on the landing page.
- Print stylesheet.
- Copy-to-clipboard in the file header.
- Runner kill switch via NEXT_PUBLIC_RUNNER_ENABLED.
- Explicit AI crawler rules in robots.txt.
- Sitemap extended to the indexable policy pages.

## Awaiting a decision

1. Dark/light toggle: add it (reversing the dark-only decision), or keep dark only and mark these two rows NA.
2. Support address on the legal pages is the operator's personal Gmail. Confirm or replace.
