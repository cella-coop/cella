+++
title = "Body"
updated = 2026-11-16
+++

Core's body: free-form content as a Loro tree of blocks, its
canonical form, the edits that change it and the block editor that
draws it, which every slice that keeps a body builds on. It is a
library of org's core, `apps/org/core/body` (`@cella/org-body`), pure
TypeScript, and no feat: it has no schema, no SQL and no actions of its
own. The document feat keeps its drafts and versions in it
([document](../../feats/document/index.md)), and the task feat each
task's body ([task](../../feats/task/index.md)); it knows no slice.

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
  would pass the window's edge; an embed's picker, the UI core's `Select`, takes the
  focus, browses by its arrows and picks by a press or Enter, and a pick puts the caret in the
  paragraph after the embed, made where there is none; a code block's
  language is a `Select` too, and a to-do's box the UI core's `Checkbox`;
- `Clipboard`: blocks as fragments, text as runs, both as plain text;
- `SyncState`: the live sync of the draft the slice hands it, and the
  draft's hash;
- `LiveState`: a record's body kept live over its session and saved by
  this browser through the save write the slice hands it (`Live`, the
  same without Svelte, on a clock of its own), whether the session has
  said what this browser may do (`joined`) and whether it may edit, and
  the body's hash.

Blocks reorder by their grips with the UI core's `sortable`, by pointer
or keyboard; where the slice anchors comments to quotes, the quotes are
highlighted in the draft where their cursors still find them. The look is the UI core's `Blocks`; nothing here
styles itself. `Reader` draws a canonical form read-only, for a version on
a motion's page.

A slice mounts the editor over its own draft: it hands it the Loro
document, the write that takes an update, sent by the page's `send`, and
the live stream it
listens on, and the editor knows nothing of where the bytes are kept.

## The live session

A record's body is edited live: the server joins each open body as one
more Loro peer, in memory, merges what every editor sends and relays it
to the others; each editor's browser saves the merged document as a
snapshot, signed by its device as every write is. The session is core
body's (`./api`, `Session`), and it knows no feat: a feat that keeps
bodies hands it, when its `./api` mounts, its kind (the collection its
records are served under), how to read a record's circle and its saved
body as the reader sees them, and the name of its save action, as the
collection's `body`, which the shell mounts in the session by the
collection's name; the shell, which starts it, hands it its connections
and membership's `may`, the slice's `may`, with which no one holds a
power where no slice serves it. The session calls what it was handed and imports nothing, and
saves nothing itself, since the server signs with none
([signatures](../../../../_corpus/doc/signatures.md)).

- **Joining.** An editor opens `/<collection>/<record>/body/live`, a
  stream of server-sent events: `joined`, whether this peer may edit,
  its address, the name of the save action, the session's version
  vector, the last save's, who contributed since and the hash of the
  body the record holds, the `base` its next save names; then an `update`
  holding all it lacks by the Loro version vector it sends (`vv`), then
  each update merged, from any peer, its own too, which Loro imports
  once, with who contributed since the last save. The browser names its
  Loro peer (`peer`), and the session names its person for that peer's
  edits from then on; the first to claim a Loro peer keeps it. The first
  to open a body starts the session from the saved snapshot, the next
  ones join it, and the last to leave closes it. Joining needs
  `discuss` in the record's circle, asked of the membership feat's
  `may` as every power is; one who may read the record and not discuss
  it gets the body read-only, and one who reads no such record nothing.
  An editor posts its updates to the same address, a Loro update in the
  form's `update` field, answered as a form's post is; bytes that are
  not a Loro update, or leave the body with no canonical form, are
  refused.
- **Mid-session.** The session asks again at every update a peer posts
  and at every save, and drops the peer whose answer is no, telling it
  why (`dropped`): a mandate revoked while its holder edits ends their
  editing at their next keystroke, the update it sent refused; what
  they sent while they held it stands, and the next save names them
  among its contributors. At a save, a writable peer that may no longer
  discuss the body is dropped, and any peer that no longer reads it.
- **Saving.** An editor's browser saves through the feat's save action,
  signed by its device as a document's edits are: after a pause of 3
  seconds in its edits, and when it leaves the body, the page's
  unmounting or the tab's hiding. It posts to the session first every
  edit it holds that the session lacks, its own and those it heard from
  other editors, and saves only once the session accepted all of them,
  its version vector holding the browser's, and once the browser holds
  all the session had accepted when it joined, the update `joined`
  promised imported, its version vector holding the one `joined` named:
  where a post fails or is refused, or the joined update has not
  arrived, it makes no save, keeps the edits, says why, and tries again
  after its next pause, so no save carries an edit the session refused
  or never had, whoever made it, and none leaves out an edit the session
  had accepted before the browser joined. The save carries the snapshot of
  the merged document as the browser holds it, in its `snapshot` field;
  its `base`, the SHA-256 of the saved body it last imported, empty for
  a body never saved; and the addresses of who contributed since the
  last save, one `contributor` field each, which the session tells each
  editor with the updates it relays, its own person among them where it
  edited. The feat's guard refuses a save whose `base` is not the hash
  of the body the record holds, naming both hashes and that the browser
  merges the saved body and saves again: the handler reads that hash,
  `encode(sha256(body), 'hex')`, under the row's lock in the save's own
  transaction and puts it in the entry as `replaced` beside the `base`,
  since at the verdict the row holds the new body, and the guard
  refuses where the two differ; so a save replaces the body
  only where its snapshot holds the one it replaces, and a stale
  snapshot never erases another editor's save. The feat's fold sets the
  record's `body` column to it. Then the browser posts `saved` to the
  live address: the session reads the snapshot the record holds now, as
  that editor reads it, counts from it who contributed since, and tells
  every editor (`saved`) with the snapshot and its hash, which each
  browser imports, Loro merging it into what it holds, and takes as its
  `base`; it saves at its next pause where it holds an edit the record
  does not. A browser whose save is refused reads the record's body by
  posting `saved`, which the session answers with the snapshot and its
  hash; where that is not the body its `base` named, it imports it and
  saves at once, its edits and the saved ones merged, and where it holds
  nothing the saved body does not, it makes no save. A save with nothing
  new since the last save is not made, so of editors pausing together
  the first saves and the rest find nothing new. A save refused, or one that fails,
  keeps the edits in the session and in the browser, says why, and is
  tried again after the browser's next pause.
- **A crash.** The server keeps no buffer: what was merged since the
  last save is held in the session and in each open editor's browser. A
  server that restarts starts a body's session again from its saved
  snapshot when the first editor rejoins; an editor's browser rejoins
  with its version vector, posts the whole update the session lacks,
  its own edits and those it heard from others before the crash, and
  saves at its next pause only once the session accepted that update;
  a catch-up refused or failed is posted again at the next pause, and
  until it is accepted the browser saves nothing, though it made no
  edit of its own. So a crash of the server loses nothing an open
  browser holds, and no browser saves past the session. A browser closed with edits no save carried
  loses them, but where another editor's browser holds them.

A slice mounts the editor over the session's stream, handing `LiveState`
the Loro document, the session's address and the feat's save write,
sent by the page's `send`: the editor knows
nothing of where the bytes are kept.

## Threads

A record's comments are its feat's own: each feat that has them keeps
a comment table in its schema, with a foreign key to its record and the
author's to `person.person`, and its own post and resolve actions and
folds. What every feat shares is drawn here: `Thread`, a root comment
with its flat replies under it, one level as in Linear, and its resolve
on the root; under each comment its reactions, a fixed set of six,
👍 ❤️ 😄 🎉 👀 🙏, each with its count and toggled by a click, shown
where the record's circle has `reactions` on, the default
([settings](../circle/index.md#settings)); the box that posts one; and the mention picker, which
offers the people who may read the record and inserts a mention, a
reference to a core person by address, `@[address]` in the comment's
text and a row of the feat's mention table, that the thread draws by
their current name, an erased person's as erased. A thread's events sit in
the record's Activity with the log's, and a mention is a row of the
person's Inbox: no page gathers every comment.

A feat gains a body or threads by `cella scaffold body|comments <feat>`
([the CLI](../../rs/index.md#commands)), which writes them into its own
folder, as the project feat's were; then `cella check feats` holds them
whole: a feat whose table keeps a `body` of core body's, a `bytea`,
declares `<feat>:body:save` with `discuss`, its fold, its guard on the
save's `base` and the session's mount, and a feat with a thread's comment table, `<feat>.comment` with
replies by `parent`, declares post, resolve and react with theirs, and
the mention table and the reaction guard, each refused by name where
one is missing. A motion's text body and a document's anchored comments
are their feats' own, and not held.

## Tests

- Slice tests (`core/body/ts/_tests/`): the edits, marks, outlines,
  patches and anchors; three peers converging over 300 seeded rounds of
  random concurrent edits; and the canonical form, the TypeScript one
  and the database's, byte for byte on 300 random bodies, refusing the
  same ones.
- The live session's slice tests (`_tests/session.test.ts`), on a
  clock of their own: two peers editing through a session over a save
  of the test's own, converging, and a late joiner catching up; the
  saves a browser's pauses and its leaving make, each signed by its
  device and naming who contributed, a save with nothing new not made,
  and a refused save kept for the next; no save after a post that
  failed or was refused; a browser whose joined update is delayed, which
  edits, posts its edit and makes no save until the update arrives, then
  saves a snapshot holding the other editor's accepted edit with its
  own; two browsers saving from one base, the second refused for its
  `base`, then merging the first's save and saving both
  editors' edits; a peer dropped when its answer
  turns no, at an update and at a save, a reader who may not discuss
  and one who reads nothing; a restart in which a peer rejoins, posts
  what the session lacks and saves it; a restart in which a browser
  that made no edit of its own but heard another editor's rejoins, its
  catch-up refused, and makes no save until a later catch-up is
  accepted; and the live route's events and posts.
- The editor's browser walk stays the document feat's
  (`_e2e/editor.test.ts`), since a document's page is where it is
  driven; a record's page drives the same editor, over the live
  session, in the task feat's walk (`_e2e/body.test.ts`): two members
  editing one task's body in two tabs, each browser's saves signed and
  naming both, and a reload opening on the save.
- The threads' slice tests (`_tests/thread.test.ts`): a text's parts and
  its mentions, each once in the order given; a box's typed `@name`
  turned into `@[address]` for the people picked alone; and a record's
  comments grouped into threads, each root with its replies in order.
