# Ideas

Candidate work that is deliberately **not built**. Nothing here is a promise;
each entry says what it costs so a decision can be made quickly.

## How file types work today

Two enums in Postgres drive the whole editor:

- `files.kind` — `markdown` | `code`
- `files.language` — `python`, `javascript`, `typescript`, `html`, `css`, `java`,
  `cpp`, `go`, `rust`, `sql`, `bash` (only when `kind = 'code'`)

`markdown` is plain text on purpose (SPEC §1 non-goals: no rendering, no preview).
`src/lib/languages.ts` is the single source of truth for what each language does,
and [adding-a-language.md](adding-a-language.md) already documents the two-step
migration needed for a new enum value.

So there are two very different kinds of "new file type":

1. **A new language** — one enum value, an entry in `languages.ts`, an extension
   mapping, optionally a highlighter and a runner. Cheap. No schema shape change.
2. **A new kind** — changes `file_kind`, the new-file dialog, icons, the editor
   shell, the file header, and every place that asks "is this a code file?". Expensive.

## Ranked: new languages

| Idea | Fit | Cost | Notes |
|---|---|---|---|
| **Mermaid** (`.mmd`) | High | Low–medium | Render `graph TD …` to SVG in the preview pane, the way HTML/CSS already preview. Text stays the source of truth, so versions work for free. Needs mermaid.js (~1 MB unpacked) loaded on demand, a dark theme, and SVG sanitising. |
| **JSON** (`.json`) | High | Low | Highlighting plus `JSON.parse` validation and a Format button. This is the most-used "not quite code, not quite notes" file there is. |
| **YAML** (`.yaml`, `.yml`) | High | Low | Same as JSON, validating with a small parser. Config files are the second half of the same gap. |
| **Plain text** (`.txt`) | Medium | Low | A kind would be overkill; a `plain` language with no highlighting and no formatter gives the same result inside `code`. |
| **TOML** (`.toml`) | Medium | Low | Cheap once YAML exists. |
| **SQL dialect split** (`.pgsql`, `.mysql`) | Low | Low | Cosmetic; the current `sql` covers it. |

**Recommendation:** add `mermaid`, `json`, and `yaml`. Three enum values, three
entries in `languages.ts`, one new preview component. That is a weekend, not a
rewrite, and it fills the biggest gap in what the tree can hold.

## Ranked: new kinds

| Idea | Fit | Cost | Notes |
|---|---|---|---|
| **Diagram** (`.mmd` promoted) | High | Medium | Only worth it if Mermaid proves popular: it removes the language picker for that file and gives the kind its own icon. Mechanically: `file_kind` gains `diagram`, `language` stays null, editor swaps to preview-first. |
| **Checklist / todo** | Medium–high | Medium | Markdown plus interactive `- [ ]` checkboxes. Toggling writes back to the source, so the file stays text. Contradicts the "markdown never renders" decision, so it needs a SPEC change first. |
| **Table / CSV** (`.csv`) | Medium | High | A grid editor means a second editor surface: selection, undo, validation, delimiter handling, large-file limits. Much bigger than it looks. |
| **Notebook** (`.ipynb`) | Low–medium | Very high | Cells, kernels, outputs. The browser runner covers the useful 10%; the remaining 90% is a different product. |
| **Canvas / whiteboard** | Low | Very high | Needs image/blob storage, which the storage model and 25 MB quota were built to avoid. |
| **Slides / deck** | Low | High | Not what a notes-and-code tree is for. |

## Other ideas, not file types

| Idea | Why | Cost |
|---|---|---|
| **Command palette** (`Ctrl/Cmd+K`) | The tree is fast but deep; jumping to a file by name is faster. | Medium |
| **Pinned files** | Some files are open all day. A pin row above the tree beats scrolling. | Low |
| **Folder colours / icons** | Cheap orientation aid in deep trees. | Low |
| **Snapshot diff** | Versions exist but `restore_project` is all-or-nothing. Showing which files changed in a snapshot makes history usable. | Medium–high |
| **Duplicate file** | Forks a file or a folder in one action; today it is copy-paste by hand. | Low |
| **Language badge in the header** | `languages.ts` already knows runs/preview/external; surfacing it saves a click before pressing Run. | Very low |
| **Search** | Already planned for v1.1 in the SPEC. | High |

## Explicitly not doing

- Markdown rendering as a default view — the SPEC rules it out; a checklist kind
  would need that decision revisited, not quietly overridden.
- Image uploads — breaks the storage model and the quota maths.
- Anything requiring a second backend or a background worker; the free-tier
  budget is the constraint the whole design rests on.
