+++
title = "Document"
updated = 2026-11-01
+++

The co-op's texts: statutes, internal rules, rate cards, policies and
minutes, written together and adopted by motion. A document is a Loro
tree of blocks that members edit at once; a version is a named, immutable
point in its history, named by the hash of its canonical form; adoption
makes one version the document's binding text. The motion that adopts
it is the `document-motion` graft's.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| document | `id`, `title` | its binding version is its latest adoption's |
| update | `receipt`, `author`, `at`, `bytes` | a Loro update; the draft is their merge |
| version | `id`, `saved`, `snapshot`, `canonical`, `hash`, `plain`, `frontier`, `vv` | the document at a Loro frontier; `id` is `<document>@<n>` |
| comment | `version`, `author`, `at`, `quote`, `anchor`, `text`, `resolved` | on the text it quotes, anchored by Loro cursors |
| adoption | `receipt`, `version`, `base`, `adopted` | makes a version binding, naming the one it replaces |

## The model

A document is one `LoroTree` (`blocks`). Each node is a block: its data
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

An embed shows a thing of another slice inside the document: the
document holds only its kind and ref, and the slice that knows the kind
draws it, through the page's `embeds` (a motion is
`document-motion`'s, a meeting `document-meeting`'s). This feat knows
no motions and no meetings.

## The canonical form

A version is named by the BLAKE3 of its canonical form, as `b3sum`
computes it: the block tree as JSON per RFC 8785 (JCS),
`{"blocks":[…],"v":1}`, each block in reading order with its `type`, the
props its type keeps, its text as `runs` (each a `text` with its sorted
`marks`) and its `children`; block ids left out, empty runs and children
left out, equal neighbouring runs joined. Numbers are safe integers;
anything else, an unknown type, or bytes that are not a whole Loro
document, has no canonical form. See
[trust](../../../../_corpus/doc/trust.md#what-a-motion-adopts).

The database computes it: a version keeps a Loro snapshot, and its
`canonical`, `hash` and `plain` columns are generated from it by the
`cella` extension (`cella.document_canonical`, `cella.document_hash`,
`cella.document_text`, Rust over the `loro` crate pinned to the
`loro-crdt` the browser runs). The server never takes a hash from a
client. `models/canonical.ts` writes the same bytes in TypeScript, so the
editor previews the hash a version saved now would have; the slice tests
hold the two to the same bytes on 300 random documents.

## Lifecycle

| Thing | States |
|---|---|
| document | draft (no adopted version) → adopted (some version binds) |
| version | saved → adopted, or superseded when a later version is adopted |
| comment | open → resolved |

Editing never stops: a document with an adopted version keeps a live
draft, and the next adoption names a later version.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/document/create` | confluent | a fact; a taken id is refused |
| `POST /api/document/edit` | confluent | Loro merges them |
| `POST /api/document/version` | confluent | a version is the document at a frontier; two saves are two versions |
| `POST /api/document/comment` | confluent | anchored to the text, needs no notary |
| `POST /api/document/adopt` | ordered | names the adopted version it replaces, not the draft; refused only if that moved on |

- **create** starts a document, named by its title's slug, and may open
  its draft with blocks as the creator's first edit, as a meeting's
  minutes open on the meeting's card and agenda.
- **edit** sends a Loro update. Loro is a CRDT: concurrent edits merge to
  the same document in any order, offline included, with no server
  ruling. An update must import onto the draft and leave it with a
  canonical form.
- **version** saves a snapshot of the document at the frontier the saver
  read, or at the merged draft's, as a numbered, immutable version; the
  log commits to its hash.
- **comment** adds a comment to a version, on text it quotes, anchored by
  Loro cursors at the quote's ends in the block that holds it; a cursor
  names characters, not offsets, so the draft finds the quote however the
  text around it moves.
- **adopt** makes a version binding. It names the version it adopts and
  the adopted version it replaces (`base: 'adopted'`); the notary refuses
  it if another adoption settled in between. The log commits to the
  adopted version's hash. Edits to the draft after the version was saved
  do not refuse it: the members voted on the version, not the draft.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| create, edit, version, comment | `edit-document` | every member, through the `member` role's mandate |
| adopt | decided: the cited motion asks to adopt this content and carried | `ag` for the internal rules, `coordination` for the rate card |

`002-powers.sql` and `003-create.sql` register `edit-document` in `cella.power`, and the
`circle-membership` graft checks it as any other: every member holds it
through a mandate on a role every member is seated in, never by
omission, so a non-member's or a suspended member's device is refused.
The power covers every document; a power per document is not built.

## Invariants

The document feat owns:

- a version, once saved, never changes, and is named by its content;
- an adoption names a version of this document;
- the adopted version only moves forward, from the base the adoption
  names; two adoptions from the same base cannot both settle.

What it does not own: that the cited motion asks for this content (the
`document-motion` graft's), that it closed and passed on its roll
(`circle-membership-motion`'s, attached through `motion.cites`), and which
circle a document belongs to (a later `circle-document` graft's; today the
adopting motion names its circle).

## Schema

`document` (`core/sql/`):

- `document.document`: id and title.
- `document.update`: the draft's Loro updates, by receipt, with author and
  day; one carried over from before the log has no author. The draft is
  their merge, which Loro reaches in any order.
- `document.version`: `<document>@<n>`, numbered next in its document by a
  trigger under a lock on the document (a carried-over version names its
  number); its day; its Loro snapshot, and generated from it its
  canonical JSON, its hash and its plain text, each block a line; and the
  Loro frontier and version vector it was saved at. A snapshot with no
  canonical form cannot be inserted.
- `document.comment`: a version, author, day, quote, anchor (`{ block,
  from, to }`, the cursors in base64), text and whether it is resolved.
  A trigger refuses a quote the version's text does not hold.
- `document.adoption`: an adoption by receipt: the version, its base and
  the day it was adopted. `document.adopted` is each document's latest.

Updates, versions and adoptions never change, by trigger; a comment
changes only by being resolved. The triggers raise SQLSTATE `09000`. The
app role may select, and insert updates, versions, comments and
adoptions; the guards role, `cella_guards`, may select.

## Guards

- `document.adopts`, on `document:document:adopt`: the write's adoption
  names a version of its document, and its base is the version the latest
  adoption before it made binding, and the version is later than that one.
  A second adoption from the same base is refused; edits to the draft
  never refuse one.

## Handlers

- `create` (confluent), and `creating`, its write, which a graft runs in
  its own, as `document-meeting` begins a meeting's minutes: inserts the
  document under its id or its title's slug, refusing a taken one, and,
  given blocks, pastes them into a new Loro document and appends it as
  the draft's first update, by the creator, committing to its digest.
- `edit` (confluent): checks the update imports onto the draft and leaves
  it with a canonical form (bytes that are not are thrown, not logged),
  appends it with a receipt and commits to it in the log by its BLAKE3
  digest.
- `version` (confluent): merges the updates, snapshots the document at the
  given frontier or the latest, and saves it with its frontier and version
  vector; the payload carries the hash the database computed.
- `comment` (confluent): anchors the quote in the version's snapshot and
  adds the comment; refused at rung 1 if the quote is not in the version.
- `adopt` (ordered, `base: 'adopted'`): records the adoption with a receipt
  on the verdict date and submits `{ document, version, hash, base,
  motion, receipt }`; the cited motion is an id this feat does not
  resolve.
- `draft(db, document)`: the merged draft's canonical form, for reading.

Loro is `loro-crdt`, pinned to an exact version, in this package only.

## Live editing

Every member with a document open edits the same draft and sees the
others' edits as they settle. The relay is server-sent events: the
document's stream, `/documents/<id>/live`, opens with one update holding
everything the client lacks by the version vector it sends, then relays
each settled edit; listening starts before the catch-up is read, and what
arrives twice Loro imports once. The browser posts its own edits, every
quarter second while it types, as one update through the page's `edit`
action, signed as the acting member; offline they wait, and the stream
reopens from the client's version vector, so nothing is missed whatever
order writes committed in. Server-sent events rather than a WebSocket:
edits already go up as signed writes through the form actions, so the
stream only carries what settled, one way, over plain HTTP the shell
already serves. The relay lives in the server process; a second process
would relay through Postgres's `LISTEN` and `NOTIFY`.

## Shell

The `documents` collection, with a New form starting an empty document
by its title; a document's page edits the draft in the block editor,
over it where the draft stands (saved as the latest version, or changed
since it), whether this member's edits are saved and that `/` adds a
block, which an empty block it holds the caret in, and the last block
when empty, also say; the draft's hash as the page was read is among
its Properties. The header saves the draft as a version (`version`), and
the page comments on one (`comment`). The server renders the draft read-only; the editor takes it
over once the browser holds the Loro document.

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
  grip;
- `Input`: typing, Enter, Backspace and Delete across blocks, markdown
  shortcuts (`#`–`###`, `-`, `1.`, `[]`, `>`, ```` ``` ````, `---`), marks
  pending at a caret, and the keys;
- `ChoiceState`: blocks chosen whole (Shift and an arrow at an edge,
  Escape, a grip, a drag leaving its block), deleted, nested and moved
  together;
- `MenuState`: the slash menu, the embeds the page offers among its
  items, the toolbar over a selection, and Ctrl-K's link in the UI core's
  popover;
- `Clipboard`: blocks as fragments, text as runs, both as plain text;
- `SyncState`: the live sync above, and the draft's hash.

Blocks reorder by their grips with the UI core's `sortable`, by pointer
or keyboard; comments' quotes are highlighted in the draft where their
cursors still find them. The look is the UI core's `Blocks`; nothing here
styles itself. `Reader` draws a canonical form read-only, for a version on
a motion's page.

## Tests

- Slice tests (`core/ts/_tests/`): the edits, marks, outlines, patches and
  anchors; three peers converging over 300 seeded rounds of random
  concurrent edits; and the canonical form, the TypeScript one and the
  database's, byte for byte on 300 random documents, refusing the same
  ones, with a version's generated columns and immutability.
- `_e2e/document.test.ts`: concurrent edits, versions named by hash,
  comments by cursor, adoption by hash under m-2026-011.
- `_e2e/editor.test.ts`: the editor in Chromium, Firefox and WebKit
  (nixpkgs' Playwright browsers), two tabs syncing through the shell:
  typing, Enter and Backspace across blocks, shortcuts, the slash menu and
  its embeds, Tab, Delete, Ctrl-K, arrows, choosing blocks by keys and by
  drag, moving them, reordering by grip with pointer and keyboard, the
  clipboard, composition (driven over CDP in Chromium; elsewhere as the
  events an IME fires), the caret held through the other tab's edits,
  undo of one's own edits, offline edits converging, a block repainted
  after a foreign mutation, and a fuzzer of random keys, compositions and
  remote edits that checks the page shows the model and the tabs
  converge. Real IMEs, touch, screen readers and right-to-left text are
  not tested.

## Lanterne

- The internal rules, version 3, were adopted on 20 June 2026 by
  m-2026-007: remote days, the pay ratio of 1.6, the solidarity rate and
  the clients Lanterne refuses.
- The 2027 rate card has two versions. Version 2 (20 October) embeds
  m-2026-011, adds online shops and raises brand identity to 6 500 €. The
  seed carries each version over as one Loro update from one peer,
  patching the outline onto the one before.
- Malik commented on version 2's retainer price, asking whether Nuvola's
  renewal in January keeps the current rate; he objects to m-2026-011,
  which would adopt version 2, by its hash, open until 9 November.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `document.documents` to the analytics shell: each document, how many versions it has, when it was last saved and adopted.
