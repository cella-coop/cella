+++
title = "Block editor spike: nabu"
updated = 2026-10-24
+++

# Block editor spike: nabu

Two nabu editors on two LoroDocs, synced in the page and seeded with the
2027 rate card. `pnpm dev` serves it on port 5182, `pnpm test` runs the
unit and convergence tests, and `./run-e2e.sh` runs the browser tests in
nixpkgs' Chromium (on port 5192).

## The package

The npm name `nabu` belongs to a static site generator from 2013. The
editor is `@aionbuilders/nabu` 0.1.0-beta.0 (2026-06-14), from
github.com/aionbuilders/nabu: 74 stars, 59 commits (51 by one author, 8 by
Claude), none since 2026-06-11. `package.json` says MIT, but neither the
repository nor the tarball has a licence file. It is about 11,300 lines of
JavaScript with JSDoc types, shipped as Svelte sources, and two Vite
plugins sit among its runtime dependencies.

## How it works

- **Model:** a LoroTree, `blocks`. Each node map holds a `type`, a `text`
  LoroText and props. Marks are Loro styles with `expand: none`. Lists are
  wrappers (list › list-item › list), and only list items nest, so Tab
  works in lists only. The canonical form drops the wrappers: an item is a
  `bullet`, `numbered` or `todo` block whose children are its sublist's
  items.
- **Input:** one contenteditable. Every `beforeinput` is cancelled and
  becomes a Loro edit; Svelte re-renders, then the caret is set from model
  offsets. During IME composition the DOM leads, and the text is written to
  Loro at `compositionend`. Issue #6 (IME) is still open, but HEAD handles
  composition and the CDP test passes.
- **Extensions:** one object per feature, holding a block class, a
  component, hooks (`onBeforeInput`, `onKeyDown`, `onSplit`), actions,
  input rules, paste interpreters and text styles. The decision embed took
  162 lines on it.

## What nabu gave and what was added

| From nabu | Added here | Lines |
|---|---|---|
| Paragraph, heading, quote, code, divider and list blocks | Decision embed, an atomic card | 162 |
| Split, merge, cross-block delete, Tab in lists | Fixes for Tab and root indices, Cmd-K link, Alt-Shift-Arrow moves | 168 |
| Markdown shortcuts, slash menu, Cmd-B/I/E, copy and paste | Toolbar and drag handle scoped to one editor | 297 |
| Local Loro UndoManager | Sync, offline queue, caret pinned across remote edits, updates held during composition | 69 |
| | Canonical JSON (RFC 8785), BLAKE3 from `@noble/hashes` | 134 |
| | Seed, page, theme | 434 |

The spike adds 1,264 lines of TypeScript and Svelte to nabu's 11,300,
plus 876 lines of tests. The seeded card hashes to `c6b0f693…` in both
Node and Chromium.

## Defects found

Each one is worked around from outside nabu.

- **No remote path.** nabu never imports an update. A remote edit
  re-renders the block and drops the caret to the start of its text node.
  The spike pins the caret to Loro cursors around each import.
- **Stale root indices.** Root blocks load at index 0, so a cross-block
  delete right after load keeps the blocks between its ends. The fix is
  `updateRoots()` after construction.
- **Tab** puts the caret back at offset 0.
- **Page-wide state.** The drag handle, the toolbar and the selection read
  the whole page and look blocks up by id. With two editors on one page,
  a drop in one moves the block in the other.
- **Smaller ones:**
  - `create()` turns index 0 into "append".
  - Shift-Tab leaves an empty sublist.
  - Loro subscriptions are never removed.
  - `onInit` adds a paragraph to an empty document, so peers must start
    from the same snapshot.

## Test results

- **Unit (24):** split, merge, indent and outdent, move, marks, JCS,
  ordering, the same hash from different histories, and the pinned seed
  hash.
- **Convergence (fast-check):** 500 runs of three peers, about 6,000
  random edits through nabu's own handlers, exchanged in random order.
  Every run converges. A single-peer baseline shows that the one odd
  structure, an empty list, is nabu's.
- **Browser (20, Chromium 1248):**
  - typing, Enter, Backspace, Delete and arrows across blocks;
  - markdown shortcuts and the slash menu;
  - Tab nesting, cross-block delete and keyboard moves;
  - Cmd-B, Cmd-K, the toolbar and undo;
  - paste, copy and drag (including an item out of its list);
  - offline merge;
  - IME through CDP, a remote edit during a composition, and a remote edit
    beside the caret.

  All 60 runs pass at `--repeat-each=3`.

## Open gaps

- Drag moves one block.
- The caret skips the decision card: it is deleted by selecting across it
  or with its ×.
- Not measured: typing latency, mobile keyboards, real IMEs.

## Quality and risk

The design is coherent, and the extension API is its best part. Against
it:

- the selection model is derived from the page's single selection;
- `commit()` is sometimes awaited and sometimes not;
- every instance adds its own listeners to `document`;
- the tests cover one editor and one peer;
- the bus factor is one, the project has been silent for four months, and
  the licence is unclear.

## Verdict: ideas only

nabu's model matches the benchmark, and it saved real work on block
behaviour. But "Loro-native" here means Loro as storage and undo, not
collaboration. Remote edits under a live caret, which cella needs most,
had to be built around its re-render-then-reset-caret core. A fork would
mean owning 11,000 lines of untyped JavaScript and reworking that core.

Worth taking:

- the extension object;
- cancelling `beforeinput` so edits go to the model first;
- `consume()` merges and the spine walk for cross-block deletes;
- per-block paste rules;
- `expand: none` marks with stored marks.

A fork is the fallback only if the native spike stalls.
