+++
title = "Document"
updated = 2026-10-24
+++

The co-op's texts: statutes, internal rules, rate cards, policies and
minutes, written together and adopted by decision. A document is a Loro
text that members edit at once; a version is a named, immutable point in
its history; adoption makes one version the document's binding text. The
decision that adopts it is the `decision-document` graft's.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| document | `id`, `title` | its binding version is its latest adoption's |
| update | `receipt`, `author`, `at`, `bytes` | a Loro update; the draft is their merge |
| version | `id`, `saved`, `body`, `hash`, `frontier`, `vv` | the text at a Loro frontier, with its version vector; `id` is `<document>@<n>` |
| comment | `version`, `author`, `at`, `quote`, `text`, `resolved` | anchored by the text it quotes |
| adoption | `receipt`, `version`, `base`, `adopted` | makes a version binding, naming the one it replaces |

The live text is the Loro document itself; the server keeps its updates
and relays them. A version is the text at a frontier, so naming a version
names exactly the text the members read, however the draft moves on
after it.

## Lifecycle

| Thing | States |
|---|---|
| document | draft (no adopted version) → adopted (some version binds) |
| version | saved → adopted, or superseded when a later version is adopted |
| comment | open → resolved |

Editing never stops: a document with an adopted version keeps a live
draft, and the next adoption names a later version.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/document/edit` | confluent | Loro merges them |
| `POST /api/document/version` | confluent | a version is the text at a frontier; two saves are two versions |
| `POST /api/document/comment` | confluent | anchored to the text, needs no notary |
| `POST /api/document/adopt` | ordered | names the adopted version it replaces, not the draft; refused only if that moved on |

- **edit** sends Loro updates. Loro is a CRDT: concurrent edits merge to
  the same text in any order, offline included, with no server ruling.
- **version** saves the text at the frontier the saver read, or at the
  merged draft's, as a numbered, immutable version.
- **comment** adds a comment to a version, anchored by the text it quotes;
  a version never changes, so the quote stays where it was.
- **adopt** makes a version binding. It names the version it adopts and
  the adopted version it replaces (`base: 'adopted'`); the notary refuses
  it if another adoption settled in between. Edits to the draft after the
  version was saved do not refuse it: the members voted on the version,
  not the draft.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| edit, version, comment | `edit-document` | every member, through the `member` role's mandate |
| adopt | held by the circle the document belongs to, by decision | `ag` for the internal rules, `coordination` for the rate card |

`002-powers.sql` registers `edit-document` in `cella.power`, and the
`circle-member` graft checks it as any other: every member holds it
through a mandate on a role every member is seated in, never by
omission, so a non-member's or a suspended member's device is refused.
The power covers every document; a power per document is not built.

## Invariants

The document feat owns:

- a version, once saved, never changes;
- an adoption names a version of this document;
- the adopted version only moves forward, from the base the adoption
  names; two adoptions from the same base cannot both settle.

What it does not own: that the cited decision asks for the adoption (the
`decision-document` graft's), that it closed and passed on its roll
(`circle-decision-member`'s, attached through `decision.cites`), and which
circle a document belongs to (a later `circle-document` graft's; today the
adopting decision names its circle).

## Schema

`document` (`core/sql/`):

- `document.document`: id and title.
- `document.update`: the draft's Loro updates, by receipt, with author and
  day; one carried over from before the log has no author. The draft is
  their merge, which Loro reaches in any order.
- `document.version`: `<document>@<n>`, numbered next in its document by a
  trigger under a lock on the document (a carried-over version names its
  number); its day; its body in canonical markdown, which a check enforces
  (LF line endings, NFC, one final newline); `hash`, generated as
  `cella.digest(body)`, the plain BLAKE3 that `b3sum` computes; and the
  Loro frontier and version vector it was saved at.
- `document.comment`: a version, author, day, quote, text and whether it is
  resolved. A trigger refuses a quote the version's body does not hold.
- `document.adoption`: an adoption by receipt: the version, its base and
  the day it was adopted. `document.adopted` is each document's latest.

Updates, versions and adoptions never change, by trigger; a comment
changes only by being resolved. The triggers raise SQLSTATE `09000`. The
app role may select, and insert updates, versions, comments and
adoptions; the rules role, `cella_rules`, may select.

## Rules

- `document.adopts`, on `document:document:adopt`: the write's adoption
  names a version of its document, and its base is the version the latest
  adoption before it made binding, and the version is later than that one.
  A second adoption from the same base is refused; edits to the draft
  never refuse one.

## Handlers

- `edit` (confluent): checks the update imports onto the draft (bytes that
  are not a Loro update are thrown, not logged), appends it with a receipt
  and commits to it in the log by its BLAKE3 digest.
- `version` (confluent): merges the updates, takes the text at the given
  frontier or the latest, canonicalises it and saves it with its frontier
  and version vector; the payload carries its hash.
- `comment` (confluent): adds a comment; refused at rung 1 if the quote is
  not in the version.
- `adopt` (ordered, `base: 'adopted'`): records the adoption with a receipt
  on the verdict date and submits `{ document, version, base, decision,
  receipt }`; the cited decision is an id this feat does not resolve.
- `draft(db, document)`: the merged text, for reading.

Loro is `loro-crdt`, pinned to an exact version, in this package only; the
text lives in the container `body`.

## What it does not know

Document knows no decisions, circles or members beyond the authors'
addresses. Meeting minutes are documents, linked to their meeting by a
later `document-meeting` graft. End-to-end encryption of documents, with
per-document keys, arrives at rung 5.

## Lanterne

- The internal rules, version 3, were adopted on 20 June 2026 by
  d-2026-007: remote days, the pay ratio of 1.6, the solidarity rate and
  the clients Lanterne refuses.
- The 2027 rate card has two versions. Version 2 (20 October) adds online
  shops and raises brand identity to 6 500 €. The seed carries each
  version over as one Loro update from one peer.
- Malik commented on version 2's retainer price, asking whether Nuvola's
  renewal in January keeps the current rate; he objects to d-2026-011,
  which would adopt version 2, open until 9 November.
