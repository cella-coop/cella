+++
title = "Block editor spike: native"
updated = 2026-10-24
+++

# Block editor spike: native

A Loro-native block editor with no editor library: two editors on two
LoroDocs, synced in the page and seeded with the 2027 rate card. `pnpm dev`
serves it on <http://localhost:5181/>, `pnpm test` runs the unit and
convergence tests, `pnpm e2e` (`run-e2e.sh`) runs the browser tests in
nixpkgs' Chromium on port 5191. The editor's runtime dependencies are
`loro-crdt` 1.17.1 and `@noble/hashes` 2.4.0 (BLAKE3, pure JS, for the
canonical hash only).

## The model

A document is a `LoroTree` named `blocks`. Each node's data map holds
`type`, the props its kind keeps (`level`, `checked`, `language`,
`decision`) and a `LoroText`. Every block holds a text, atomic ones too, so
turning a divider back into a paragraph never races two peers creating the
text concurrently. Block identity is the tree node id; nesting is tree
children. Marks are Loro's own: bold, italic and code expand after, link
expands nowhere. `configTextStyle` is per doc and not in the history, so
every client configures the same styles in `createDoc`.

The edits (`model/ops.ts`) are plain functions on a doc: split, merge,
indent, outdent (the following siblings become children, so reading order
holds), move before/after/into, retype, toggle a mark, paste fragments.
None commits; the caller makes one commit per user action, which is one undo
step and one update on the wire.

The canonical form is the ordered tree with kind, kept props, text as runs
with their marks, and children, empty runs and children omitted. Block ids
are left out: two documents that read the same hash the same however they
were made. It is serialised per RFC 8785 (JCS, a 15-line serialiser) and
hashed with BLAKE3. Both sides show the hash live, and the page shows
"Converged" when they match and nothing is queued.

## The editor

Every text block is its own `contenteditable`, painted from Loro by hand;
Svelte draws the element and never its children. Every `beforeinput` is
refused and made in Loro instead, using the browser's target range for
grapheme, word and spelling edits. The exception is composition: the IME
owns the DOM until `compositionend` (or Safari's `insertFromComposition`),
when the block is repainted from Loro and the composed text is inserted at a
Loro cursor taken at `compositionstart`. Remote edits to a composing block
wait until it ends.

Local and remote changes mark the blocks they touch; a flush rebuilds the
row list only on structural change (row objects are reused, so Svelte redraws
only changed rows) and repaints only dirty texts. A remote text edit carries
the caret through its delta, read from the DOM selection before the repaint.

Blocks: one component per kind, including a `decision` card that is atomic,
selectable and movable. Enter splits (carrying marks; Enter on an empty list
item ends the list), Backspace at the start resets the kind and then merges,
Delete at the end merges the next. Arrows cross blocks; Tab and Shift-Tab
nest. Markdown shortcuts: `#`–`###`, `-`, `1.`, `[]`, `>`, ```` ``` ````,
`---`. The slash menu filters as you type and is keyboard-driven. Ctrl-B/I/E
toggle marks (pending marks for the next text when nothing is selected);
Ctrl-K and the selection toolbar link. Block selection, as in Notion,
comes from Shift-arrows at a block's edge, Escape, the handle, or a mouse
drag that leaves its block; selected blocks delete, copy, cut, nest and move
with Alt-Shift-arrows. The drag handle moves the selection before, after or
into a block. Blocks copy as fragments with plain text beside them; plain
text pastes as paragraphs. Undo is Loro's `UndoManager`, this peer only. The
page can take the link offline and add a delay.

## Lines of code

Non-blank, non-comment lines; the Svelte figures include their CSS.

| Part | Files | Lines |
|---|---|---|
| Model and canonical form | `model/doc.ts`, `ops.ts`, `canonical.ts` | 416 |
| Input | `EditorState` (input, keys), `editor/dom.ts` | 534 |
| Rendering | `EditorState` (flush, caret), block components, `Editable`, `Editor` | 679 |
| UX chrome | `EditorState` (slash, block selection, clipboard, drag), `Block`, `Slash`, `Toolbar` | 626 |
| Demo page and sync | `PairState`, routes, seed | 273 |
| Tests | unit, convergence, e2e | 719 |

## Tests

- **Unit, 17**: split, merge (with children), indent, outdent, move, marks
  and their expansion, retype, JCS ordering, canonical bytes, hash stability
  across peers and across independent seeding, fragment round trip, caret
  through a remote delta.
- **Convergence, 1**: three peers, 600 seeded iterations of 1–4 rounds of
  random concurrent edits (text insert and delete, marks, split, merge, move,
  indent, outdent, retype, create, delete) with partial gossip, then a full
  exchange in random order: identical canonical bytes and version vectors
  every time (about 30 s).
- **Browser, 22** (Chromium 1248, headless): typing and sync, Enter and
  Backspace across blocks, markdown shortcuts, the slash menu, Tab nesting,
  pending bold, Delete-merge, Ctrl-K, stepping onto the decision card,
  arrows across blocks, Shift-arrow and drag selection with delete, moving a
  selection, drag-and-drop reorder and nest, block copy and paste, plain-text
  paste, IME composition over CDP, the caret held while the other side edits
  the same block (once, and interleaved with every keystroke), local-only
  undo, and offline queueing. Eight full runs after the last fix passed with
  no flakes.

## The hard problems

- **Caret ownership.** The browser tests found two bugs the unit tests could
  not. A block's mount attachment read the slash menu's state while placing
  the caret, so opening the menu remounted the block and dropped the caret
  to 0; it runs untracked now. And `selectionchange` lags the keys that move
  the caret, so cursors taken there were stale when a remote edit landed;
  the caret now rides the remote delta from the live DOM selection.
- **Selection across contenteditables.** A native selection cannot span
  two editing hosts, so a cross-block selection is a block selection, as in
  Notion. A text selection from mid-block to mid-block does not exist.
- **IME.** Tested only with CDP's `imeSetComposition`/`insertText`
  in Chromium. Real IMEs, Safari's composition order and Android's
  keyboards, which compose every word, are untested.
- **UTF-16.** Loro refuses an offset inside a surrogate pair; the DOM hands
  them out. The convergence test found it; offsets snap to code points.

Untested: Firefox, Safari, mobile (touch selection, Gboard, iOS), screen
readers, large documents, right-to-left text, and extensions that rewrite the
DOM (Grammarly): nothing reconciles a foreign DOM mutation. Ctrl-K uses
`window.prompt`. Arrow navigation between wrapped lines relies on caret
rectangles.

## Verdict

Yes, cella can own this editor. The feature set fits in about 2,250 lines
that cella controls end to end, with no bindings between a library's model
and Loro: the tree is the document, and the canonical form falls out of it.
The cost is the long tail of browser input (mobile composition, Safari,
foreign DOM mutation), which a library mitigates only where it has met the
same bugs. Before users touch it, budget a hardening pass on Safari,
Firefox and Android, a MutationObserver fallback that repaints a block
changed behind the editor's back, and a split of `EditorState` (1,200
lines) into input, selection and clipboard modules.
