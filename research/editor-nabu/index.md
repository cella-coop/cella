+++
title = "Block editor spike: nabu"
updated = 2026-10-24
+++

# Block editor spike: nabu

Two nabu editors on two LoroDocs, synced in the page, seeded with the 2027
rate card. `pnpm dev` serves it on port 5182, `pnpm test` runs the unit
and convergence tests, and `./run-e2e.sh` runs the browser tests with
nixpkgs' Chromium (on port 5192).

## The package

The npm name `nabu` is a static site generator from 2013. The editor is
`@aionbuilders/nabu` 0.1.0-beta.0 (2026-06-14), from
github.com/aionbuilders/nabu: 74 stars, no forks, 59 commits (51 by Killian
Di Vincenzo, 8 by Claude), with no commit since 2026-06-11. `package.json`
says MIT, but neither the repository nor the tarball carries a licence
file. It is about 11,300 lines of JavaScript with JSDoc types, partly
commented in French, and ships its Svelte sources. Its runtime
dependencies include two Vite plugins (which pull in `@swc/core`) and the
author's own event bus.

## How it works

- **Model:** a LoroTree named `blocks`; each node's map holds `type`, a
  `text` LoroText and props. Marks are Loro text styles, set to
  `expand: none`. Lists are wrappers (list › list-item › list), and only
  list items (and callouts and toggles) have children, so Tab nests list
  items only. The canonical form splices the wrappers away: an item is a
  `bullet`, `numbered` or `todo` block whose children are its sublist's
  items.
- **Input:** a single contenteditable. Every `beforeinput` is cancelled and
  turned into Loro edits, Svelte re-renders, and the caret is put back from
  model offsets after a tick. During an IME composition the DOM leads and
  the composed text is written to Loro at `compositionend`. Issue #6 (IME)
  is still open, but the code at HEAD handles it, and a CDP composition
  passes.
- **Extensions:** one object per feature, carrying a block class, a
  component, hooks (`onBeforeInput`, `onKeyDown`, `onSplit`,
  `onBeforeTransaction`), named actions, input rules, paste interpreters
  and Loro text styles. The decision embed took 162 lines on this API.

## What nabu gave and what was added

| From nabu, unchanged | Added or replaced here | Lines |
|---|---|---|
| Paragraph, heading, quote, code, divider and list blocks | Decision embed, an atomic card | 162 |
| Split, merge, cross-block delete, Tab in lists | Tab elsewhere kept in the editor; the caret kept on Tab | in 168 |
| Markdown shortcuts, slash menu, Cmd-B/I/E | Cmd-K link field, Alt-Shift-Arrow block moves | in 168 |
| Copy and paste (nabu JSON, HTML, markdown) | Toolbar and drag handle scoped to one editor | 297 |
| Loro UndoManager, local only | Sync, offline queue, caret pinned across remote edits, updates held during composition | 69 + in 168 |
| | Canonical JSON (RFC 8785) and BLAKE3 | 134 |
| | Seed, page, theme mapping | 344 + 63 CSS |

That is 1,264 lines of TypeScript and Svelte on top of nabu's 11,300, plus
876 lines of tests. BLAKE3 comes from `@noble/hashes`, a pure-JS library;
the seeded card hashes to `c6b0f693…` in Node and in Chromium alike.

## Defects found

Each one is worked around from outside nabu; none of it is patched in
place.

- **No remote path.** nabu never imports an update, and nothing keeps the
  caret when a remote edit re-renders a block, which drops the caret to the
  start of the text node. The spike pins the caret to Loro cursors before
  an import and restores it afterwards.
- **Stale root indices.** Root blocks load at index 0 and keep it until the
  tree first changes, so a cross-block delete made right after load keeps
  the blocks between its ends. The workaround is `updateRoots()` after
  construction.
- **Caret lost on Tab.** Tab and Shift-Tab put the caret back at offset 0.
- **Shared page state.** The drag handle, the toolbar and the selection
  read the whole page and look blocks up by id. With two editors on the
  same document, both handles show, and a drop in one moves the block in
  the other.
- **Smaller ones.** `create()` passes `index || undefined`, so a block
  created at index 0 is appended instead. Shift-Tab on a sublist's only
  item leaves an empty list behind. A block's Loro subscriptions are never
  removed. `onInit` adds a paragraph to an empty document, so every peer
  has to start from the same snapshot.

## Test results

- **Unit tests (24, Vitest and happy-dom):** split, merge, indent and
  outdent, moves, marks, JCS, canonical ordering, the same hash from
  different histories, and the pinned seed hash. They drive nabu's own
  handlers.
- **Convergence (fast-check):** 500 runs of three peers making about 6,000
  random nabu edits (type, delete, split, merge, mark, indent, retype,
  move, check, drop), exchanging updates in random order. Every run
  converges to identical canonical JSON. A single-peer baseline shows that
  the only odd structure, an empty list, is nabu's own.
- **Browser tests (20, Chromium 1248):** typing, Enter and Backspace across
  blocks, Delete, arrow keys across blocks, markdown shortcuts, the slash
  menu (heading and decision), Tab nesting, a cross-block delete, Cmd-B,
  Cmd-K, the toolbar, undo, paste of text and of markdown, multi-block
  copy, keyboard moves, drag (including an item out of its list), the
  offline merge, an IME composition, a remote edit during a composition,
  and a remote edit beside the caret. All 60 runs pass at
  `--repeat-each=3`. Screenshots are in `editor-nabu-shots/`.

## Open gaps

- **Selection and moves:** the drag handle moves one block, and keyboard
  moves stay among siblings.
- **Decision card:** the caret skips the card, so it is deleted by
  selecting across it or with its × button.
- **Not measured:** typing latency on large documents, mobile keyboards,
  and real IMEs (the IME test uses CDP's synthetic composition).

## Quality and risk

The architecture is coherent, and the extension API is the best part. Its
weaknesses are a selection model derived from the page's single DOM
selection, abstractions that leak (blocks reach into `nabu.tree`, and
`commit()` is sometimes awaited and sometimes not), and per-instance
listeners on `document`. The tests are many but cover one editor and one
peer. Bus factor is one, there has been no activity for four months, and
the licence is unclear.

## Verdict: ideas only

nabu's model matches the benchmark's (a LoroTree of blocks and LoroText
with marks), and it saved real work on block behaviours. But "Loro-native"
here means Loro as storage and undo, not collaboration. The part cella
needs most, remote edits under a live caret, is missing and had to be
built around nabu's re-render-then-reset-caret core. Forking would mean
owning 11,000 lines of untyped JavaScript and reworking that core, along
with its page-wide selection.

Worth taking:

- the extension object shape;
- cancel every `beforeinput` and edit the model first;
- `consume()` for merges and the spine walk for cross-block deletes;
- per-block markdown and HTML rules for paste;
- `expand: none` marks with stored marks.

A fork is the fallback only if the native spike stalls.
