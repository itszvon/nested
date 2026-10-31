# Adding a language

The checklist for every new language. Fields change, the order does not.

## 1. Decide what it can do here

Three honest tiers, and the app must say which one applies:

- **Runs**: JavaScript, TypeScript (types erased, then run as JavaScript), Python, SQL.
- **Previews**: HTML, CSS. Rendered, not executed as a program.
- **Edit only**: everything else. Coloured, checked, formatted where a formatter exists, but the Run button explains why it will not start.

Never add a language to the picker without knowing its tier, because the picker promises whatever the runner denies.

## 2. Database, in two migrations

Postgres will not let a freshly added enum value be used in the same transaction, so these cannot be one file.

**Migration A** adds the values only:

```sql
alter type public.file_language add value if not exists 'yourlanguage';
```

**Migration B** registers the extensions. The lookup table exists so this needs no function change:

```sql
insert into public.file_extensions (extension, language) values
  ('ext', 'yourlanguage');
```

Push both, then confirm:

```sql
select extension, language from public.file_extensions order by extension;
```

## 3. App

| File | Change |
|---|---|
| `src/app/app/editor.tsx` | A case in `loadLanguage`, dynamic import of the parser |
| `src/app/app/dialogs.tsx` | Entry in `LANGUAGES` and in `EXT_LANGUAGE` |
| `src/lib/whitespace.ts` | Add to `BRACE_LANGUAGES` if blocks use `{}`, otherwise leave it |
| `src/app/app/runner.tsx` | `LANGUAGE_LABEL` entry so the refusal names the language |
| `src/app/home/page.tsx` | Language count, the list in the editor feature, the limits table |

Parsers that ship a `StreamLanguage` legacy mode (Bash, for example) are wrapped differently from modern packages. Check the package before assuming the API.

## 4. Formatting, only if it exists

The Format button must hide when there is no formatter rather than fail. Today:

| Language | Formatter |
|---|---|
| JavaScript, TypeScript, HTML, CSS | Prettier |
| Java | prettier-plugin-java |
| Python | Ruff (WASM) |
| C++ | clang-format (WASM) |
| Go, Rust, SQL, Bash | none yet |

## 5. Checks

Nothing to do. Parse errors come from the language's own grammar through the shared linter, and mixed indentation is checked for every language. Add a heuristic only if it cannot produce false positives.

## 6. Verify

```bash
npm run typecheck
npm run build
PGPASSWORD=<db password> npm run db-check
```

Then in the app: create a file with the new extension, confirm the language appears in the header, confirm highlighting loads, type an obvious syntax error and see a squiggle, press Run and confirm the message names the language.

## 7. Update the landing page

The limits table and the editor feature block name the languages. Both are claims on a public page, so they get updated in the same commit as the enum.
