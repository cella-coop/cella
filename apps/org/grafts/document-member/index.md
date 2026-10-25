+++
title = "document-member"
updated = 2026-10-25
+++

Who has read the co-op's texts: a member marks a document's binding
version read, which is what joining asks of a new member. Declared by
the `member` feat.

## Schema

`document_member` (`sql/`):

- `document_member.reading`: a version, a member and the day they read
  it, once each, with no foreign key into either feat.
- `document_member.texts`: for each member, every document's binding
  version, its latest adoption, and the day they read it, or none; a
  later adoption asks a new reading.

The app role may select, insert and keep a reading's first day; the
rules role may select.

## Writes

| Write | Label | Check | Why |
|---|---|---|---|
| `document-member:version:read` | confluent | `self` | a fact the member states of themselves; marking a version read again changes nothing |

## Rules

- `document_member.reads`, on `document-member:version:read`: the
  reading is the actor's own, of a version that exists, marked on the
  verdict date.

## Tests

`ts/_tests/reading.test.ts` (`cella test slice document-member`): the
texts each member is to read, a new adoption asking a new reading, and
the rule outside a write.

## Shell

On a member's page, under Joining, the texts the co-op adopted, whether
they read each, and marking one read, their own.

## Lanterne

The ten members read the internal rules' third version before the
assembly adopted it on 20 June 2026; Inès has not marked it read yet. The
statutes are not a document of Lanterne's yet, so the internal rules are
the one text to read.
