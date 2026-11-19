+++
title = "Document"
updated = 2026-11-19
+++

The coop's texts: statutes, internal rules, rate cards, policies and
minutes, written together and adopted by motion. A document is a Loro
tree of blocks that members edit at once; a version is a named, immutable
point in its history, named by the hash of its canonical form; adoption
makes one version the document's binding text. The motion that adopts
it is the `document-motion` graft's. The statutes are written by no one:
they are generated from the assembly's policies in order and frozen
at each adoption ([generated documents](#generated-documents)).

## Entities

| Entity | Fields | Notes |
|---|---|---|
| document | `id`, `title` | its binding version is its latest adoption's |
| update | `n`, `receipt`, `author`, `at`, `bytes` | a Loro update; the draft is their merge |
| version | `id`, `saved`, `snapshot`, `canonical`, `hash`, `plain`, `frontier`, `vv` | the document at a Loro frontier; `id` is `<document>@<n>` |
| comment | `version`, `author`, `at`, `quote`, `anchor`, `text`, `resolved` | on the version as a whole, or on the text it quotes, anchored by Loro cursors |
| adoption | `n`, `receipt`, `version`, `base`, `adopted` | makes a version binding, naming the one it replaces |
| generated | `document`, `circle`, `template` | a document generated from a circle's policies, around its template |
| generation | `document`, `version`, `motion`, `day` | what a generated version cites and the day it reads; a motion is cited by no version but the adopted one and those after it |

## The model

A document is one body of blocks, core's Loro tree ([blocks](../../core/body/index.md)):
its block types, marks, edits and embeds are core's, and a version is
named by the BLAKE3 of the blocks' canonical form
([the canonical form](../../core/body/index.md#the-canonical-form)),
which the database computes from the version's snapshot
(`cella.document_canonical`, `cella.document_hash`,
`cella.document_text`). The server never takes a hash from a client. An
embed in a document shows a motion through `document-motion` and a
meeting through `document-meeting`; this feat knows no motions and no
meetings.

## Generated documents

A document may be generated from a circle's policies, as the statutes
are from the assembly's: `document.generated` names the circle, by id
as the policy register names it, and the template, the fixed text of the
coop's legal form, as blocks (the fragments `create` takes). In the
template, an `embed` block of kind `policies` stands where the policies
read, its `ref` a kind (`procedure`, `mandate` or `rule`), or empty for
every kind. Generating replaces each with one `numbered` block per
policy of the circle in force on the day, of its kind, in their order,
its legal wording as it reads. Their order is the register's (`inOrder`
in `@cella/org-policy`): each policy where the first policy of its line
reads, by the motion and the action that adopted that one, so a
replacement takes the place of the policy it replaces
([policies](../../../../_corpus/doc/architecture.md#policies)). An
`embed` block of kind `departures`, its `ref` a legal form
(`scop-sarl-fr`), stands where the defaults of that form the circle left
or never took read: one `bullet` block each, `Leaves the SCOP SARL,
France default, by m-2026-020/1: <its sentence>.`, or `Never took the
… default: …`, in the form's order (`departures` in
`@cella/org-policy`), or one paragraph saying the document leaves none
([legal forms](../../../../_corpus/doc/forms.md)).

It changes only as its circle's policies do. Each adoption or ending of
one of them is followed by `generate`, which patches the generated
blocks onto the draft, saves the result as the next version and adopts
it, in one write whose log entry commits to the version's hash: the
document is frozen at each adoption, and every earlier version still
reads. Each generated version keeps the motion it cites and the day it
reads, and a generation never goes back: it cites a motion no version
of the document cites unless the adopted one does, so a motion's
several changes, however many, generate one version each in a row and
an earlier motion is
never cited again once a later one's version is adopted, and reads the later of the day that motion's
change applies and the day the adopted version reads, so a policy
adopted to apply before a change the document already reads lands in
the version that reads them both. An edit, a version or an adoption by hand is refused; a comment is
not. A generated document is carried over with its template, as the
seed carries Lanterne's statutes; no action creates one or changes its
template yet.

Minutes, contracts and letters are not generated: they are ordinary
documents, edited together and adopted as their own text.

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
| `POST /api/document/generate` | ordered | as adopt: names the adopted version it replaces |

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
- **comment** adds a comment to a version: on the version as a whole,
  quoting nothing, or on text it quotes, anchored by Loro cursors at the
  quote's ends in the block that holds it; a cursor names characters, not
  offsets, so the draft finds the quote however the text around it moves.
- **adopt** makes a version binding. It names the version it adopts and
  the adopted version it replaces (`base: 'adopted'`); the notary refuses
  it if another adoption settled in between. The log commits to the
  adopted version's hash. Edits to the draft after the version was saved
  do not refuse it: the members voted on the version, not the draft.
- **generate** generates a generated document from its circle's policies
  in force on the day a motion's adoption or ending of one of them
  applies, or on the day the adopted version reads where that is later,
  and the defaults of its form the circle left by then, saves it as the next version and adopts it, naming the
  adopted version it replaces, as adopt does. It cites the motion. The
  log commits to the version's hash.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| create, edit, version, comment | `edit-document` | every member, through the `member` role's mandate |
| adopt | `adopt-document`, a collective mandate: the cited motion asks to adopt this content and carried | `ag` for the internal rules, `coordination` for the rate card |
| generate | `adopt-policy`, a collective mandate: the cited motion adopted or ended a policy of the document's circle that day, and carried | `ag` for the statutes |

`002-powers.sql` and `003-create.sql` register `edit-document` in `cella.power`, and the
membership feat checks it as any other: every member holds it
through a mandate on a role every member is seated in, never by
omission, so a non-member's or a suspended member's device is refused.
The power covers every document; a power per document is not built.

## Invariants

The document feat owns:

- a version, once saved, never changes, and is named by its content;
- an adoption names a version of this document;
- the adopted version only moves forward, from the base the adoption
  names; two adoptions from the same base cannot both settle;
- a generated document's version reads every policy of its circle in
  force on its day and no other of its policies, and it changes by no
  hand;
- a generated document's versions cite a motion only in a row, and
  their days only move forward: a motion cited by a version before the
  adopted one and not by the adopted one, or a day earlier than the
  adopted version's, is refused,
  the refusal naming the version that cites it or the day that version
  reads.

What it does not own: that the cited motion asks for this content (the
`document-motion` graft's), that it closed and passed on its roll
(`membership-motion`'s, attached through `motion.cites`), and which
circle a document belongs to (a later `circle-document` graft's; today the
adopting motion names its circle).

## Schema

`document` (`core/sql/`):

- `document.document`: id and title.
- `document.update`: the draft's Loro updates, numbered by `n` and
  ordered by receipt, then `n`, since one write may append several, as a
  close whose effects generate a document twice; with author and day; one carried over from before the log has no author. The draft is
  their merge, which Loro reaches in any order.
- `document.version`: `<document>@<n>`, numbered next in its document by a
  trigger under a lock on the document (a carried-over version names its
  number); its day; its Loro snapshot, and generated from it its
  canonical JSON, its hash and its plain text, each block a line; and the
  Loro frontier and version vector it was saved at. A snapshot with no
  canonical form cannot be inserted.
- `document.comment`: a version, author, day, quote, anchor (`{ block,
  from, to }`, the cursors in base64), text and whether it is resolved.
  A comment on the version as a whole has neither quote nor anchor, and
  only a quoted comment is anchored. A trigger refuses a quote the
  version's text does not hold, and checks nothing where there is none.
- `document.adoption`: an adoption, numbered by `n`, at its write's
  receipt: the version, its base and the day it was adopted, ordered by
  receipt, then `n`. `document.adopted` is each document's latest. It reads as its reader.
- `document.generated` (`004-generated.sql`): a generated document, the
  circle whose policies it reads, and its template, a JSON array of
  fragments; it never changes.
- `document.generation` (`004-generated.sql`): what each generated version
  cites and reads, one row for each motion it cites: the version, the
  motion and the day whose policies it reads; it never changes. A version `generate` makes cites one motion; one the
  seed carries over cites each motion whose change it first reads.
  `document.reads(base, day)` is the day a generation from `base` reads:
  the later of `day` and the day `base` reads.

Updates, versions and adoptions never change, by trigger; a comment
changes only by being resolved. The triggers raise SQLSTATE `09000`. The
app role may select, and insert updates, versions, comments and
adoptions; the guards role, `cella_guards`, may select. The app inserts a
generation as `generate` makes its version.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`document.document.circle` is the circle the document is owned by, which
its creation names; its updates, versions and adoptions are in its
circle and a comment in its version's, which `document.in_its_circle`
copies into each as it is made. `document.generated.circle` is the
circle whose policies it reads, which it names always.

## Guards

- `document.adopts`, on `document:document:adopt`: the write's adoption
  names a version of its document, and its base is the version the latest
  adoption before it made binding, and the version is later than that one.
  A second adoption from the same base is refused; edits to the draft
  never refuse one. It judges `document:document:generate` too.
- `document.generates`, on `document:document:generate`: the document is
  generated; no version of it but the adopted one cites the motion, or
  the refusal names the one that does; the cited motion adopted a policy of its
  circle applying on the write's day or ended one that day; the version
  reads the day `document.reads` gives from the version it replaces, and
  one earlier is refused, naming the day that version reads; and it
  reads, each as a line as it reads (`circle_policy.says`), every policy of the
  circle in force on the day it reads and no other of its policies.
- `document.handmade`, on `document:document:edit`, `:version` and
  `:adopt`: the document is not generated.

## Handlers

- `create` (confluent), and `creating`, its write, which a graft runs in
  its own, as `document-meeting` begins a meeting's minutes: inserts the
  document under its id or its title's slug, refusing a taken one, and,
  given blocks, pastes them into a new Loro document and appends it as
  the draft's first update, by the creator, committing to its digest.
- `edit` (confluent): checks the update imports onto the draft and leaves
  it with a canonical form (bytes that are not are thrown, not logged),
  appends it with a receipt and submits its BLAKE3 digest, its number
  and its bytes in hex: a document's text is the coop's, so the log
  keeps it as it is.
- `version` (confluent): merges the updates, snapshots the document at the
  given frontier or the latest, and saves it with its frontier and version
  vector; the payload carries the hash the database computed, and the
  snapshot, frontier and version vector in hex.
- `comment` (confluent): anchors the quote, where it has one, in the
  version's snapshot and adds the comment; an empty or absent quote
  comments on the version as a whole. Refused at rung 1 if the quote is
  not in the version. Submits the quote and the anchor as they are, each
  null for a comment on the whole, and the text marked
  personal: a comment is its author's words, personal data of class
  `profile`, so the log keeps its commitment and the vault its value.
- `adopt` (ordered, `base: 'adopted'`): records the adoption with a receipt
  on the verdict date and submits `{ document, version, hash, base,
  motion, receipt }`; the cited motion is an id this feat does not
  resolve.
- `generate` (ordered, `base: 'adopted'`), and `generating`, its write:
  reads the template and the circle's policies in force on the day
  `document.reads` gives from the adopted version, in their order,
  generates the blocks (`models/generated.ts`), patches them
  onto the merged draft and appends what changed as an update by the
  actor, saves the snapshot as the next version and adopts it on the
  verdict date, from the adopted version before it, inserting the
  generation that cites the motion and that day; it submits
  `{ document, version, hash, base, adopted, receipt, motion, day }`.
- `draft(db, document)`: the merged draft's canonical form, for reading.

Loro is core's blocks', and this feat holds no copy of it.

## Live editing

Every member with a document open edits the same draft and sees the
others' edits as they settle. The relay is server-sent events: the
document's stream, `/documents/<id>/live`, opens with one update holding
everything the client lacks by the version vector it sends, then relays
each settled edit; listening starts before the catch-up is read, and what
arrives twice Loro imports once. The browser posts its own edits, every
quarter second while it types, as one update through the document's `edit`
write, sent by the page's `send` and signed as the acting member; offline they wait, and the stream
reopens from the client's version vector, so nothing is missed whatever
order writes committed in. Server-sent events rather than a WebSocket:
edits already go up as signed writes through the remote functions, so the
stream only carries what settled, one way, over plain HTTP the shell
already serves. The relay lives in the server process; a second process
would relay through Postgres's `LISTEN` and `NOTIFY`.

## Folds

Each action folds by `core/sql/007-folds.sql`
([folds](../../../../_corpus/doc/architecture.md#folds)), at version 1:
a creation starts the document under its id, with its title and in its
circle, and its opening update, by `document.fold_creating`, which
document-meeting's minutes fold by too; an edit appends the update
under its number and receipt, its bytes the entry's, refusing bytes
whose digest is not the entry's; a version saves the entry's snapshot,
frontier and version vector, refusing a snapshot that hashes otherwise;
a comment adds the comment on the quote and anchor its entry carries,
or on the version as a whole where both are null, its text as its
commitment, and `document.quotes` refuses a quote the folded version
does not hold; an adoption records it from the base it
names; a generation writes, in its order, the update where the draft
changed, the version and its adoption, as the entry carries them.

## Shell

The `documents` collection, with a New form starting an empty document
by its title; a document's page edits the draft in the block editor,
over it one quiet line at the top right saying where the draft stands
(saved as the latest version, or changed since it) and whether this
member's edits are saved, with no heading of its own; `/` adds a block,
which an empty block it holds the caret in, and the last block when
empty, say; the draft's hash as the page was read is among
its Properties. The header's New version opens the shared Dialog,
saying what it saves, the draft as the version it will number, and
whether that is unchanged or changed since the latest one; it ends in
Save version and Cancel, posting `version` and closing on a settled
write, a refusal staying inside with its reason, and Cancel, Escape or
a click outside it saves nothing. Its comments are drawn as every
comment is ([comments](../../core/ui/index.md#comments)), under its
Activity, oldest first: each a card, in its rich text, under the
version it is on and what it quotes, if anything, a resolved one folded
to a line. Under them the comment box is always there, written rich,
and comments on the latest saved version as a whole. Text selected
inside one block of the draft floats a Comment button at the
selection's end, which attaches the selection to the box as its quote,
shown read-only inside the box's top with the version it is on as a
quiet line and a small × that drops it, as Escape in the box does, and
puts the focus in the comment's text; another selection attached
replaces it. A document with no version takes no comment. The box posts
`comment`, by its arrow or Ctrl or Cmd with Enter, and a posted
comment's quote is highlighted in the draft as the page refreshes. Its
page is laid out as `body` ([record page
layout](../../../../_corpus/doc/architecture.md#record-page-layout)), the
draft its body; its saved versions are the Versions tab after the
draft. The server renders the draft read-only; the editor takes it
over once the browser holds the Loro document. A generated document's
page reads its draft without the editor or the header's New version,
and says whose policies it is generated from.

The editor is core's blocks' ([the editor](../../core/body/index.md#the-editor)),
mounted over the document's draft with its `edit` action and its live
stream; this feat anchors its comments to quotes, and the editor
highlights them where their cursors still find them. `Reader`, core's
too, draws a version read-only on a motion's page.

## Tests

- Slice tests (`core/ts/_tests/`): a version's generated columns and
  immutability, its hash the blocks' canonical form's
  ([blocks](../../core/body/index.md#tests)); a comment on a quote the
  version holds, one on the version as a whole with no quote or anchor,
  and a quote the version lacks refused; and the
  folds (`folds.test.ts`): a document started, edited, saved, commented
  on, with a quote and without, a quote the version lacks refused, and
  adopted, and a generation, each folded from its entry.
- `_e2e/document.test.ts`: concurrent edits, versions named by hash,
  comments by cursor and on the version as a whole, adoption by hash
  under m-2026-011.
- `_e2e/capital.test.ts`: once the assembly adopts new capital terms,
  the statutes' next version is generated and adopted with the new
  sentence where the founding one read, its hash in its log entry and
  recomputed from the version; the earlier version still reads, and an
  edit, a version or an adoption of the statutes by hand is refused.
- `_e2e/generated.test.ts`: a generation never goes back: after
  `statutes@3`, the founding motion and its day cited again are refused
  naming `statutes@1`, which cites it; a motion's two changes, ending
  a policy and adopting another, generate a version each in a row, both
  citing it, the second reading both changes (`forms`); a motion's three
  policy changes generate three versions in a row, each citing it and
  the third reading all three; a motion's second change cited once
  another motion's version is adopted after its first is refused,
  naming the version its first change made; a rule adopted to apply on
  20 December after one adopted to apply on 1 January generates a version reading 1 January, and so both,
  and the January motion, cited again once that version is adopted, is
  refused;
  a motion whose generation never ran, cited later by hand, reads the
  adopted version's day.
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
  converge. Then what the walk in a headless browser found broken
  ([the review](../../../../_corpus/review/2026-11-09/editor-walk.md)),
  each walked again: a new document typed into, and one undone past its
  first block; the caret leaving a code block that ends the document; the
  caret after a picked embed, and its picker browsed by arrow without
  picking; the slash menu near the window's bottom; the drag preview
  holding its text; chosen blocks copied and pasted, and a comment's
  text cut and copied while blocks are chosen, the blocks left in the
  draft and the clipboard holding the text; a comment quoting
  the selection, highlighted once posted; a comment on the document as a
  whole, its attached quote dropped first; and the toolbar following its
  selection as the window narrows. Real IMEs, touch, screen readers and
  right-to-left text are not tested.

## Lanterne

- The statutes are generated from the assembly's policies, around the
  fixed text of a worker co-operative limited company with variable
  capital: `statutes@1`, adopted on
  1 March 2021 with m-2021-001's procedures, mandates and rules, and
  `statutes@2`, on 20 June 2026, once m-2026-007 adopted the internal
  rules' five rules. The seed generates each and adopts it that day.
- The internal rules, version 3, were adopted on 20 June 2026 by
  m-2026-007: remote days, the pay ratio of 1.6, the solidarity rate and
  the clients Lanterne refuses.
- The 2027 rate card has two versions. Version 2 (20 October) embeds
  m-2026-011, adds online shops and raises brand identity to 6 500 €. The
  seed carries each version over as one Loro update from one peer,
  patching the outline onto the one before.
- Each working circle keeps a working text of its own: Web's
  accessibility checklist, embedding m-2026-017, Brand's print
  specifications, Marketing's newsletter style guide, embedding
  m-2026-015, and Operations' month-end close.
- Malik commented on version 2's retainer price, asking whether Nuvola's
  renewal in January keeps the current rate; he objects to m-2026-011,
  which would adopt version 2, by its hash, open until 9 November.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `document.documents` to the analytics shell: each document, how many versions it has, when it was last saved and adopted. It is scoped by `circle`, the circle that owns the document. Its view is declared a published query, in `core/ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
