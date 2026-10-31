# Nested documentation

Everything lives here. The repository root keeps only `README.md` (entry point)
and `AGENTS.md` (rewritten by `next dev`).

| File | What it is |
|---|---|
| [SPEC.md](SPEC.md) | The specification: behaviour, data model, limits. Source of truth. |
| [PRODUCT.md](PRODUCT.md) | Product direction and decisions. |
| [DESIGN.md](DESIGN.md) | Design tokens, type, spacing, component rules. |
| [PLAN.md](PLAN.md) | Build plan, phase by phase. |
| [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) | Requirement-by-requirement status. |
| [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md) | Launch checklist and the honest state of operations. |
| [adding-a-language.md](adding-a-language.md) | How to add a language to the editor. |
| [surface-brief-app.md](surface-brief-app.md) | Surface brief for the app shell. |
| [IDEAS.md](IDEAS.md) | Candidate features, deliberately not built yet. |

`IMPORTANT.md` also sits in this folder but is gitignored: it holds operator
credentials and stays on the machine only.

## Where code lives

| Path | Contains |
|---|---|
| `src/app/` | Routes, server actions, client components |
| `src/lib/` | Supabase clients, tree, buffers, languages, settings |
| `supabase/migrations/` | SQL migrations, applied in filename order |
| `scripts/` | `db-check.mjs` (schema check), `seed-demo.mjs` (demo data) |
| `public/` | Static files served as-is |
