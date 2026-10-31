# Design

Written from the built interface. If the code and this file disagree, the code is wrong or this file needs updating before the next screen is built.

## World

A ledger. Entries in rows, separated by hairlines, numbers aligned in a column. The hierarchy of a file tree is the hierarchy of nested accounts: indentation plus a quiet rule, not cards and shadows.

Consequences that are not negotiable:

- No border radius anywhere. `--radius-none` is the only radius.
- No box shadows. Depth comes from hairlines and value, never from elevation.
- Dark only. There is no light theme, no toggle, and `color-scheme: dark` is set at the root.

## Colour

Defined in `src/app/globals.css` under `@theme`.

| Token | Value | Used for |
|---|---|---|
| `ground` | `#0a0c0b` | Page background, editor background |
| `panel` | `#0e1110` | Sidebar, dialogs, toolbar surfaces |
| `rule` | `#1e2421` | Every hairline: row separators, panel edges |
| `rule-strong` | `#2c3530` | Dialog borders, hovered inputs |
| `ink` | `#e9e7e1` | Primary text, file names, headings |
| `ink-dim` | `#9aa09a` | Secondary text, file names in the tree |
| `ink-faint` | `#6a706b` | Metadata, labels, disabled states |
| `accent` | `#a8442f` | Selection bar, dirty dot, primary button, errors |
| `accent-dim` | `#7a2f20` | Autocomplete selection, text selection |

Restrained strategy: neutrals carry the surface, one accent does four jobs. No other hue appears in the interface, which is why syntax colours are the only saturated thing on screen.

## Type

- UI: Geist, 13px body, 11px labels, 9 to 10px mono caps for metadata.
- Editor and metadata: Geist Mono.
- Mono caps labels use `uppercase`, `tracking-[0.1em]` to `[0.16em]`.
- Tabular numerals everywhere (`font-feature-settings: "tnum"`), because sizes, revisions and timestamps sit in columns.

## Metrics

| Element | Size |
|---|---|
| App header | 40px |
| File header strip | 44px |
| Tree row | 28px, 14px indent per level |
| Sidebar | 300px default, drag 200 to 620, remembered per device |
| Output panel | 224px default, drag 120 to 620 |
| Radius | 0 |
| Border | 1px `rule`, `rule-strong` for dialogs |

## Components

- **Tree row**: caret, type icon, name, right-aligned mono metadata. Four states: default, hover (`#111614`), multi-selected (`#141a17` plus a faint left rule), open file (panel background plus a 2px accent left bar). Drag target adds a 1px accent outline.
- **Buttons**: solid accent for the primary action in a header, 1px `rule` outline for secondary, text-only for tertiary actions in mono caps. Disabled state drops to `ink-faint` and keeps its border.
- **Dialogs**: 380px wide, `panel` background, 1px `rule-strong` border, mono caps title bar, no shadow, no backdrop blur.
- **Banners**: one line inside the content area, accent-tinted background at 10%, never a toast for something the user must act on.
- **Console**: `ground` at 70%, 12px mono, questions in `ink`, echoed answers prefixed `>` in accent, errors in red-300.

## States that must exist

Empty account, empty folder, nothing open, no versions, empty trash, dirty buffer, conflict, over quota, file missing, unsupported language for running, browser without cross-origin isolation.

## Motion

Almost none. 150ms transform on the mobile drawer, otherwise instant. No page transitions, no reveal animations, no loading spinners beyond a text status.

## Accessibility

- Keyboard: arrows, Enter, Space, F2, Delete, Ctrl/Cmd+S, Ctrl/Cmd+Enter, Escape.
- Tree exposes `role="tree"`, `treeitem`, `aria-level`, `aria-expanded`, `aria-selected`, and a roving tabindex.
- Focus is always visible: 1px accent outline with a negative offset.
- Contrast: body text `#e9e7e1` on `#0a0c0b` exceeds 15:1; `ink-dim` around 7:1; `ink-faint` is used only for metadata at 9 to 10px and never for content.

## What is deliberately absent

Light theme, rounded corners, shadows, gradients, icons beyond the three drawn type marks, illustrations, avatars, onboarding tours, hover tooltips on everything.
