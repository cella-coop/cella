+++
title = "Body"
updated = 2026-11-11
+++

Core's body: free-form content as a Loro tree of blocks, its
canonical form, the edits that change it and the block editor that
draws it, which every slice that keeps a body builds on. It is a
library of org's core, `apps/org/core/body` (`@cella/org-body`), pure
TypeScript, and no feat: it has no schema, no SQL and no actions of its
own. The document feat keeps its drafts and versions in it
([document](../../feats/document/index.md)); it knows no slice.

## The model

A body of blocks is one `LoroTree` (`blocks`). Each node is a block: its data
map holds the block's `type`, the props its type keeps and a `LoroText`,
atomic blocks too, so a change of type never races two peers creating a
text. A block's id is its node's; nesting is the tree's.

| Type | Props | Text |
|---|---|---|
| `paragraph`, `bullet`, `numbered`, `quote` | none | yes |
| `heading` | `level`, 1 to 3 | yes |
| `todo` | `checked` | yes |
| `code` | `language` | yes |
| `divider` | none | no: atomic |
| `embed` | `embed`, the kind of thing, and `ref`, which one | no: atomic |

Marks are Loro's: `bold`, `italic` and `code` expand after the text they
cover, `link` (its address) does not. Every client configures the same
expansion (`createDoc`), since Loro keeps it per document and outside the
history. The edits (`models/edits.ts`) are plain functions that never
commit: split, merge, indent, outdent, move, retype, toggle a mark, paste
fragments, and `patch`, which makes a list of blocks read as an outline
while keeping the blocks that already do. One user action is one commit:
one undo step and one update.

An embed shows a thing of another slice inside the blocks: the
blocks hold only its kind and ref, and the slice that knows the kind
draws it, through the page's `embeds` (in a document, a motion is
`document-motion`'s, a meeting `document-meeting`'s). This library knows
no slice's records. The slash menu offers each kind once; the
block it inserts has a kind and no ref yet, and asks, from the kind's
choices, which record it shows.

## The canonical form

A body of blocks has a canonical form, and a document's version is
named by its BLAKE3, as `b3sum` computes it: the block tree as JSON per RFC 8785 (JCS),
`{"blocks":[…],"v":1}`, each block in reading order with its `type`, the
props its type keeps, its text as `runs` (each a `text` with its sorted
`marks`) and its `children`; block ids left out, empty runs and children
left out, equal neighbouring runs joined. Numbers are safe integers;
anything else, an unknown type, or bytes that are not a whole Loro
document, has no canonical form. See
[trust](../../../../_corpus/doc/trust.md#what-a-motion-adopts).

The database computes it from a Loro snapshot, as a document's version
generates its `canonical`, `hash` and `plain` columns, by the
`cella` extension (`cella.document_canonical`, `cella.document_hash`,
`cella.document_text`, Rust over the `loro` crate pinned to the
`loro-crdt` the browser runs). The server never takes a hash from a
client. `models/canonical.ts` writes the same bytes in TypeScript, so the
editor previews the hash a version saved now would have; the slice tests
hold the two to the same bytes on 300 random bodies.

Loro is `loro-crdt`, pinned to an exact version, in this package only
among the TypeScript packages, and the `loro` crate pinned to it in the
notary's.

## The editor

The editor (`components/`, its state in `hooks/`) draws each block's text
by hand: Svelte draws the element, never its children. Every
`beforeinput` is refused and made in Loro, with the browser's target
range for grapheme, word and spelling edits; composition is the
exception, owned by the IME until it ends, then inserted at a Loro cursor
taken where it began. A mutation of a block that the editor did not make,
by an extension or a browser's own edit, is undone by painting the block
again from Loro. Its parts:

- `EditorState`: the blocks as views, painting, the caret as Loro cursors
  carried through remote edits, undo per peer, and a block dropped by its
  grip; a draft holding no block, a new document's or one undone past its
  first, is given an empty paragraph with the caret in it, committed
  outside the undo, so there is always a block to type in (two members
  opening an empty draft at once give one each);
- `Input`: typing, Enter, Backspace and Delete across blocks, markdown
  shortcuts (`#`–`###`, `-`, `1.`, `[]`, `>`, ```` ``` ````, `---`), marks
  pending at a caret, and the keys; Enter on a code block's empty last
  line, and ArrowDown on its last line where it ends the document, leave
  the code for a paragraph after it;
- `ChoiceState`: blocks chosen whole (Shift and an arrow at an edge,
  Escape, a grip, a drag leaving its block), deleted, copied, cut, nested
  and moved together; the page hears their copy and cut too, since
  Chromium leaves the selection mirroring them outside the editor, but
  only those fired at that selection: a press outside the editor ends
  the choice, and text selected and copied or cut anywhere else on the
  page, a comment's under Activity or a field's, is that text's, never
  the chosen blocks', which stay in the draft;
- `MenuState`: the slash menu, the embeds the page offers among its
  items, the toolbar over a selection, and Ctrl-K's link in the UI core's
  popover; the menu and the toolbar follow their caret as the window is
  resized or scrolled, and the menu opens above the caret where below it
  would pass the window's edge; an embed's picker browses by its arrows
  and picks by a click or Enter, and a pick puts the caret in the
  paragraph after the embed, made where there is none;
- `Clipboard`: blocks as fragments, text as runs, both as plain text;
- `SyncState`: the live sync of the draft the slice hands it, and the
  draft's hash.

Blocks reorder by their grips with the UI core's `sortable`, by pointer
or keyboard; where the slice anchors comments to quotes, the quotes are
highlighted in the draft where their cursors still find them. The look is the UI core's `Blocks`; nothing here
styles itself. `Reader` draws a canonical form read-only, for a version on
a motion's page.

A slice mounts the editor over its own draft: it hands it the Loro
document, the action that posts an update and the live stream it
listens on, and the editor knows nothing of where the bytes are kept.

## Tests

- Slice tests (`core/body/ts/_tests/`): the edits, marks, outlines,
  patches and anchors; three peers converging over 300 seeded rounds of
  random concurrent edits; and the canonical form, the TypeScript one
  and the database's, byte for byte on 300 random bodies, refusing the
  same ones.
- The editor's browser walk stays the document feat's
  (`_e2e/editor.test.ts`), since a document's page is where it is
  driven; a body's page drives the same editor
  ([body](../body/index.md#tests)).
