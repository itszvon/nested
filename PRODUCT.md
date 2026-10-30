# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who keeps organised reference material, research notes, and code side by
side, with programmers as the primary audience.

The typical session: a developer working on several things at once, keeping
snippets, decisions, and half-finished files that belong to a project but do not
belong in that project's git repository. They arrive from a browser tab, not an
IDE, and they may be on a different machine than yesterday.

Secondary audiences: students keeping coursework and notes together, writers
keeping outlines and drafts. Both are served by the same structure and are not
designed for separately.

## Product Purpose

A private place to store text and code in folders nested as deeply as the work
demands, with explicit saves and a per-file history you can return to.

Success looks like: opening the app and finding the file in a few seconds,
saving without ceremony, and being able to recover any state that was ever
saved. Failure looks like: losing work, or feeling obliged to tidy up before
starting.

## Positioning

Nested combines three things that currently require two tools: a filesystem-like
hierarchy, a real code editor, and version history on every file, without a
commit workflow, a branch, a remote, or a repository to set up.

GitHub is too much machinery for a note that happens to contain code. Google
Docs handles prose but cannot edit code and has no notion of a file tree. Nested
takes the useful half of each and drops the ceremony.

## Operating Context

- Desktop browser, wide window, long sessions.
- Keyboard-driven: tree navigation, save shortcuts, an editor that behaves like
  one the user already knows.
- Multiple devices, one account, no sharing.
- Work arrives by paste: a snippet, a decision, a fragment, a whole file.
- Saves are deliberate. The user decides when something becomes permanent.

## Capabilities and Constraints

- Google sign-in only. No email, magic links, guests, or public links.
- Two file types: plain-text Markdown files and code files.
- Code languages, exactly five: Python, Java, JavaScript, HTML/CSS, C++.
- Markdown files are plain text with no highlighting, rendering, or preview.
- Nothing is written to the server without a button press: Save File or Save
  Project. Local drafts exist only to survive a crash.
- Every save appends an immutable version. Restore is per file.
- Trash holds deleted files and folders for 30 days.
- Limits: 2 MB per file, 25 MB per account, 2,000 files, 500 folders.
- Dark theme only.
- Free infrastructure tier, so the product is deliberately small in scope.

## Brand Commitments

- Name: Nested.
- Dark only. No light theme, no theme toggle.
- Deliberately plain interface. The user's stated position: the value is
  functionality, not decoration.
- Further visual constraints may be given as work proceeds; nothing else is
  binding yet.

## Evidence on Hand

None. No customers, testimonials, press, benchmarks, or logos exist. Future work
must not invent any.

## Product Principles

1. **Never lose work silently.** Explicit saves, immutable versions, local
   drafts, and a trash that holds for 30 days. Every one of those exists to
   make loss recoverable.
2. **The structure is the feature.** Arbitrary depth, fast navigation, and
   nothing between the user and their file.
3. **Assume competence.** Dense information, keyboard shortcuts, no wizardry,
   no tooltips explaining what a folder is.
4. **The interface recedes.** No ceremony, no engagement mechanics, no empty
   space filled with suggestions. A file opens and is editable within a second.
5. **Deliberate over automatic.** The user decides when something is saved,
   restored, or deleted. Automation is limited to protecting against loss.

## Accessibility & Inclusion

No specific standard has been established by the product.

The spec commits to keyboard-only operation of the tree and editor, visible focus
rings, ARIA tree semantics, and a 4.5:1 contrast minimum.
