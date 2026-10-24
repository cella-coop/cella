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
| document | `id`, `title`, `adopted?` | `adopted` names the binding version, if any |
| version | `id`, `saved`, `frontier`, `body` | `frontier` is the Loro version vector; `id` is `<document>@<n>` |
| comment | `version`, `author`, `at`, `quote`, `text`, `resolved` | anchored to a span of text by a Loro cursor |

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
| `POST /api/document/comment` | confluent | anchored to the text, needs no notary |
| `POST /api/document/adopt` | ordered | names the version it saw; refused if that moved on |

- **edit** sends Loro updates. Loro is a CRDT: concurrent edits merge to
  the same text in any order, offline included, with no server ruling.
- **comment** adds or resolves a comment. Its anchor is a Loro cursor, so
  it follows its quote through later edits.
- **adopt** makes a version binding. It names the version it adopts and
  the adopted version it replaces (`base: 'adopted'`); the notary refuses
  it if another adoption settled in between. Edits to the draft after the
  version was saved do not refuse it: the members voted on the version,
  not the draft.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| edit, comment | `edit-document`, per document | every member |
| adopt | held by the circle the document belongs to, by decision | `ag` for the internal rules, `coordination` for the rate card |

## Invariants

The document feat owns:

- a version, once saved, never changes;
- an adoption names a version of this document;
- the adopted version only moves forward, from the base the adoption
  names; two adoptions from the same base cannot both settle.

What it does not own: that a decision of the right circle approved the
adoption (the `decision-document` graft's), and which circle a document
belongs to (a later `circle-document` graft's; today the adopting decision
names its circle).

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
  shops and raises brand identity to 6 500 €.
- Malik commented on version 2's retainer price, asking whether Nuvola's
  renewal in January keeps the current rate; he objects to d-2026-011,
  which would adopt version 2, open until 9 November.
