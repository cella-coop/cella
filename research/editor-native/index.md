+++
title = "Block editor spike: native"
updated = 2026-10-24
+++

# Block editor spike: native

A Loro-native block editor with no editor library: two editors on two
LoroDocs, synced in the page and seeded with the 2027 rate card. `pnpm dev`
serves it on <http://localhost:5181/>, `pnpm test` runs the unit and
convergence tests, `pnpm e2e` runs the browser tests in nixpkgs' Chromium
on port 5191. Runtime dependencies: `loro-crdt` 1.17.1, and `@noble/hashes`
2.4.0 for BLAKE3 (pure JS, canonical hash only).

## The model

A `LoroTree` of blocks; each node's data map holds `type`, the props its
kind keeps and a `LoroText`, atomic blocks too, so a retype never races two
peers creating a text. Identity is the node id; nesting is tree children.
Marks are Loro's: bold, italic and code expand after, links nowhere.
`configTextStyle` is per doc, outside the history, so every client sets it
in `createDoc`. The edits (`model/ops.ts`) are plain functions that never
commit; one user action is one commit, one undo step, one update.

The canonical form is the ordered tree (kind, kept props, runs with marks,
children; empties omitted; block ids left out, so documents that read the
same hash the same however they were made), serialised per RFC 8785 by a
15-line JCS writer and hashed with BLAKE3. The page shows both hashes live
and "Converged" when they match with nothing queued.

## The editor

One `contenteditable` per text block, painted from Loro by hand; Svelte
draws the element, never its children. Every `beforeinput` is refused and
made in Loro, using the browser's target range for grapheme, word and
spelling edits. Composition is the exception: the IME owns the DOM until
`compositionend` (or Safari's `insertFromComposition`), then the block is
repainted and the text inserted at a Loro cursor taken at the start; remote
edits to that block wait. Changes mark the blocks they touch; a flush
reuses unchanged row objects, so Svelte redraws only changed rows, and
repaints only dirty texts. A remote edit carries the caret through its
delta.

It has Enter split with marks, Backspace and Delete merge, arrows across
blocks, Tab nesting, markdown shortcuts (`#`–`###`, `-`, `1.`, `[]`, `>`,
```` ``` ````, `---`), a filterable keyboard slash menu, Ctrl-B/I/E/K with
pending marks and a selection toolbar, Notion-style block selection
(Shift-arrows at an edge, Escape, the handle, or a drag leaving its block)
that deletes, copies, cuts, nests and moves, a drag handle dropping before,
after or into a block, fragment and plain-text clipboard, an atomic
`decision` card, and per-peer undo via `UndoManager`.

## Lines of code

Non-blank, non-comment; Svelte includes CSS.

| Part | Lines |
|---|---|
| Model and canonical form | 416 |
| Input (`EditorState` input and keys, `dom.ts`) | 534 |
| Rendering (flush and caret, block components, `Editable`) | 679 |
| UX chrome (slash, block selection, clipboard, drag, toolbar) | 626 |
| Demo page, sync, seed | 273 |
| Tests | 719 |

## Tests

- **Unit, 17**: split, merge with children, indent, outdent, move, marks
  and expansion, retype, JCS ordering, canonical bytes, hash stability,
  fragment round trip, caret through a remote delta.
- **Convergence**: three peers, 600 seeded iterations of random concurrent
  edits (text, marks, split, merge, move, indent, outdent, retype, create,
  delete), partial gossip, then a full exchange in random order: identical
  canonical bytes and version vectors every time.
- **Browser, 22**: typing, Enter and Backspace across blocks, shortcuts,
  slash menu, Tab, Delete-merge, Ctrl-K, the decision card, arrows,
  Shift-arrow and drag selection with delete, moving a selection, drag and
  drop, block copy and paste, plain-text paste, IME over CDP, the caret held
  while the other side types in the same block (interleaved per keystroke),
  local-only undo, offline queueing. Eight full runs after the last fix: no
  flakes.

## The hard problems

- **Caret ownership.** The browser tests found two bugs. A block's mount
  attachment read the slash menu's state, so opening the menu remounted the
  block and dropped the caret to 0; it runs untracked now. And
  `selectionchange` lags the keys, so cursors taken there were stale when a
  remote edit landed; the caret now rides the delta from the live DOM
  selection.
- **Selection across contenteditables.** Native selection cannot span two
  editing hosts, so a cross-block selection is a block selection, as in
  Notion; there is no mid-block to mid-block text selection.
- **IME.** Tested only by CDP emulation in Chromium.
- **UTF-16.** Loro refuses offsets inside a surrogate pair; the convergence
  test found it, and offsets snap to code points.

Untested: Firefox, Safari, mobile (touch selection, Gboard, iOS), real
IMEs, screen readers, large documents, right-to-left text, and extensions
that rewrite the DOM: nothing reconciles a foreign mutation. Ctrl-K uses
`window.prompt`.

## Verdict

Yes, cella can own this editor. The feature set is about 2,250 lines cella
controls end to end, with no binding between a library's model and Loro:
the tree is the document and the canonical form falls out of it. The cost
is the long tail of browser input, which a library softens only where it
has met the same bugs. Before users touch it: a hardening pass on Safari,
Firefox and Android, a MutationObserver fallback that repaints a block
changed behind the editor's back, and a split of `EditorState` (1,200
lines) into input, selection and clipboard modules.
